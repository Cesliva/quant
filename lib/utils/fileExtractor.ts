/**
 * File Text Extraction Utility
 * Extracts text from PDF, DOC, DOCX, and TXT files
 */

export interface ExtractionProgress {
  currentPage?: number;
  totalPages?: number;
  status: "reading" | "extracting" | "processing" | "complete";
  message?: string;
}

export type ProgressCallback = (progress: ExtractionProgress) => void;

/**
 * Extract text from various file formats
 * @param file - The file to extract text from
 * @param onProgress - Optional callback for progress updates
 * @returns Extracted text content
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.`);
  }

  try {
    if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      onProgress?.({ status: "reading", message: "Reading text file..." });
      return await extractTextFromTxt(file);
    } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      onProgress?.({ status: "reading", message: "Reading PDF file..." });
      return await extractTextFromPdf(file, onProgress);
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      onProgress?.({ status: "reading", message: "Reading DOCX file..." });
      return await extractTextFromDocx(file, onProgress);
    } else if (
      fileType === "application/msword" ||
      fileName.endsWith(".doc")
    ) {
      // Try to extract from DOC using alternative method
      onProgress?.({ status: "reading", message: "Reading DOC file (legacy format)..." });
      return await extractTextFromDoc(file, onProgress);
    } else {
      throw new Error(`Unsupported file type: ${fileType || "unknown"}. Supported formats: PDF, DOC, DOCX, TXT`);
    }
  } catch (error: any) {
    if (error.message.includes("Unsupported file type")) {
      throw error;
    }
    throw new Error(`Failed to extract text from ${file.name}: ${error.message}`);
  }
}

async function extractTextFromTxt(file: File): Promise<string> {
  const text = await file.text();
  if (!text || text.trim().length === 0) {
    throw new Error("Text file appears to be empty");
  }
  return text;
}

async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  try {
    // Use pdfjs-dist for client-side PDF extraction
    const pdfjsLib = await import("pdfjs-dist");
    
    // Set worker source - use a more reliable CDN
    if (typeof window !== "undefined") {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }

    onProgress?.({ status: "extracting", message: "Loading PDF document..." });
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0, // Suppress warnings
    }).promise;
    
    const totalPages = pdf.numPages;
    onProgress?.({ 
      status: "extracting", 
      totalPages,
      message: `Extracting text from ${totalPages} page${totalPages > 1 ? "s" : ""}...` 
    });
    
    let fullText = "";
    
    for (let i = 1; i <= totalPages; i++) {
      onProgress?.({ 
        status: "extracting", 
        currentPage: i, 
        totalPages,
        message: `Processing page ${i} of ${totalPages}...` 
      });
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n\n";
    }
    
    onProgress?.({ status: "complete", message: "Extraction complete" });
    
    const extractedText = fullText.trim();
    if (!extractedText || extractedText.length === 0) {
      throw new Error("No text could be extracted from the PDF. The file may be image-based or corrupted.");
    }
    
    return extractedText;
  } catch (error: any) {
    if (error.message.includes("No text could be extracted")) {
      throw error;
    }
    throw new Error(`PDF extraction failed: ${error.message || "Unknown error"}`);
  }
}

async function extractTextFromDocx(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  try {
    onProgress?.({ status: "processing", message: "Processing DOCX file..." });
    
    // Use mammoth for DOCX extraction
    const mammoth = await import("mammoth");
    
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    onProgress?.({ status: "complete", message: "Extraction complete" });
    
    if (!result.value || result.value.trim().length === 0) {
      throw new Error("No text could be extracted from the DOCX file. The file may be empty or corrupted.");
    }
    
    // Log warnings if any
    if (result.messages && result.messages.length > 0) {
      console.warn("DOCX extraction warnings:", result.messages);
    }
    
    return result.value;
  } catch (error: any) {
    if (error.message.includes("No text could be extracted")) {
      throw error;
    }
    throw new Error(`DOCX extraction failed: ${error.message || "Unknown error"}`);
  }
}

async function extractTextFromDoc(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  // DOC (old Microsoft Word format) is a binary format that's difficult to parse client-side
  // We'll attempt to use a workaround, but recommend conversion to DOCX/PDF
  
  try {
    onProgress?.({ status: "processing", message: "Attempting to extract from DOC file..." });
    
    // Try using pdf-parse approach won't work for DOC
    // For now, we'll provide a helpful error message with conversion instructions
    // In a production environment, you might want to use a server-side solution
    
    // Attempt: Some DOC files might be readable as text (unlikely but worth trying)
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if it's actually a DOCX file mislabeled as DOC
    const header = Array.from(uint8Array.slice(0, 4))
      .map(b => String.fromCharCode(b))
      .join("");
    
    if (header === "PK\x03\x04") {
      // This is actually a DOCX file (ZIP format)
      onProgress?.({ status: "processing", message: "File appears to be DOCX format, extracting..." });
      return await extractTextFromDocx(file, onProgress);
    }
    
    // For true DOC files, we cannot extract client-side reliably
    throw new Error(
      "DOC files (old Microsoft Word format) cannot be extracted directly. " +
      "Please convert the file to DOCX or PDF format. " +
      "You can do this by opening the file in Microsoft Word and saving as DOCX or PDF."
    );
  } catch (error: any) {
    if (error.message.includes("cannot be extracted")) {
      throw error;
    }
    throw new Error(`DOC extraction failed: ${error.message || "Unknown error"}`);
  }
}

