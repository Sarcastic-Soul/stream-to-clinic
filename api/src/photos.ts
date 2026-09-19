// Report photos: stored as a FHIR Media whose content points at a Binary; the report Observation
// references the Media through derivedFrom. Served back to browsers by GET /photos/:mediaId.
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { fhir } from "./fhir.js";

export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export interface Photo {
  contentType: ImageType;
  data: Buffer;
}

// File signatures, so a data URL cannot claim to be an image it is not.
const SIGNATURES: Record<ImageType, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
};

// Parses a base64 data URL; returns the photo, or a reason it was rejected.
export function parsePhoto(dataUrl: string): Photo | string {
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return "photo must be a base64 data URL";
  const contentType = match[1] as ImageType;
  if (!IMAGE_TYPES.includes(contentType)) return `photo must be one of: ${IMAGE_TYPES.join(", ")}`;
  const data = Buffer.from(match[2]!, "base64");
  if (data.length > MAX_PHOTO_BYTES) return "photo must be at most 1.5 MB";
  if (!SIGNATURES[contentType](data)) return `photo content is not a valid ${contentType} image`;
  return { contentType, data };
}

export const photoUrl = (mediaId: string) => `${config.publicApiUrl}/photos/${mediaId}`;

// Transaction storing the photo as Binary + Media and the Observation with derivedFrom -> Media, so
// all three are stored or none. The Binary gets a client-assigned id because Attachment.url is not a
// Reference, and the server would not rewrite a placeholder there.
export function photoTransaction(observation: fhir4.Observation, photo: Photo): fhir4.Bundle {
  const binaryId = `photo-${randomUUID()}`;
  const mediaUrl = `urn:uuid:${randomUUID()}`;
  const binary: fhir4.Binary = {
    resourceType: "Binary",
    id: binaryId,
    contentType: photo.contentType,
    data: photo.data.toString("base64"),
  };
  const media: fhir4.Media = {
    resourceType: "Media",
    status: "completed",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/media-type", code: "image", display: "Image" }] },
    ...(observation.subject ? { subject: observation.subject } : {}),
    ...(observation.effectiveDateTime ? { createdDateTime: observation.effectiveDateTime } : {}),
    ...(observation.performer?.[0] ? { operator: observation.performer[0] } : {}),
    content: {
      contentType: photo.contentType,
      url: `${config.publicFhirUrl}/Binary/${binaryId}`,
      size: photo.data.length,
      title: "Citizen report photo",
    },
  };
  const report: fhir4.Observation = { ...observation, derivedFrom: [{ reference: mediaUrl }] };
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      { resource: binary, request: { method: "PUT", url: `Binary/${binaryId}` } },
      { fullUrl: mediaUrl, resource: media, request: { method: "POST", url: "Media" } },
      { resource: report, request: { method: "POST", url: "Observation" } },
    ],
  };
}

// Stores the report with its photo; returns the Observation as stored (id and Media reference set).
export async function createWithPhoto(observation: fhir4.Observation, photo: Photo): Promise<fhir4.Observation> {
  const response = await fhir.transaction(photoTransaction(observation, photo));
  // Response locations look like "Media/12/_history/1", in request order.
  const [, media, report] = (response.entry ?? []).map((e) => e.response?.location?.split("/").slice(0, 2).join("/") ?? "");
  return { ...observation, id: report?.split("/")[1], derivedFrom: [{ reference: media }] };
}

// Loads a report photo by Media id; undefined when there is no such photo.
export async function loadPhoto(mediaId: string): Promise<Photo | undefined> {
  const media = await fhir.read("Media", mediaId);
  const binaryId = media?.content.url?.match(/\/Binary\/([A-Za-z0-9\-.]{1,64})$/)?.[1];
  if (!binaryId) return undefined;
  const binary = await fhir.read("Binary", binaryId);
  const contentType = binary?.contentType as ImageType;
  if (!binary?.data || !IMAGE_TYPES.includes(contentType)) return undefined;
  return { contentType, data: Buffer.from(binary.data, "base64") };
}
