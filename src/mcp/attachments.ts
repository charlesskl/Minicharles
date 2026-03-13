import { PDFParse } from "pdf-parse";
import type { Attachment } from "../types/index.js";

/** Content types that we can return as text directly */
const TEXT_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
]);

/** Check if a content type represents a text file */
function isTextType(contentType: string): boolean {
  return TEXT_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}

/** Check if a content type represents a PDF */
function isPdfType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("application/pdf");
}

/** Check if a content type represents an image */
function isImageType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("image/");
}

/**
 * Process an attachment and return human-readable content.
 * - Text files: returns content directly
 * - PDF: extracts text using pdf-parse
 * - Images: returns metadata (filename, size, contentType)
 * - Other: returns metadata only
 */
export async function processAttachment(
  attachment: Attachment,
): Promise<string> {
  const meta = {
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
  };

  if (!attachment.contentBytes) {
    return JSON.stringify(
      { ...meta, note: "No content bytes available for this attachment" },
      null,
      2,
    );
  }

  const buffer = Buffer.from(attachment.contentBytes, "base64");

  if (isTextType(attachment.contentType)) {
    const text = buffer.toString("utf-8");
    return JSON.stringify({ ...meta, content: text }, null, 2);
  }

  if (isPdfType(attachment.contentType)) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    await parser.destroy();
    return JSON.stringify(
      {
        ...meta,
        pages: textResult.total,
        content: textResult.text,
      },
      null,
      2,
    );
  }

  if (isImageType(attachment.contentType)) {
    return JSON.stringify(
      {
        ...meta,
        note: "Image attachment — content not extracted (no OCR). Use the metadata to reference this file.",
      },
      null,
      2,
    );
  }

  // Other binary types
  return JSON.stringify(
    {
      ...meta,
      note: "Binary attachment — content type not supported for text extraction. Metadata only.",
    },
    null,
    2,
  );
}
