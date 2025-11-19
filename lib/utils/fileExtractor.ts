/**
 * File Text Extraction Utility
 * Extracts text from PDF, DOC, DOCX, and TXT files
 */

export async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      return await extractTextFromTxt(file);
    } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      return await extractTextFromPdf(file);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      return await extractTextFromDocx(file);
    } else if (
      fileType === "application/msword" ||
      fileName.endsWith(".doc")
    ) {
      throw new Error("DOC files are not supported. Please convert to DOCX or PDF.");
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

async function extractTextFromTxt(file: File): Promise<string> {
  return await file.text();
}

async function extractTextFromPdf(file: File): Promise<string> {
  // Use pdfjs-dist for client-side PDF extraction
  const pdfjsLib = await import("pdfjs-dist");
  
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n\n";
  }
  
  return fullText.trim();
}

async function extractTextFromDocx(file: File): Promise<string> {
  // Use mammoth for DOCX extraction
  const mammoth = await import("mammoth");
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  return result.value;
}

