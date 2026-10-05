import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

const hexToRgb = (hex) => {
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
};

/**
 * Exports the PDF with all annotations applied.
 * @param {ArrayBuffer} originalPdfBytes 
 * @param {Object} annotations { [pageNum]: { paths, texts, images, erasures, highlights, shapes, stamps, signatures, comments } }
 * @param {number} scale - The zoom level used in the viewer
 * @param {Object} pageRotations - { [pageNum]: degreesCW }
 * @returns {Promise<Uint8Array>}
 */
export const exportPdf = async (originalPdfBytes, annotations, scale = 1.5, pageRotations = {}) => {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const SCALE = scale;

  // Apply page rotations
  for (const [pageNumStr, rotation] of Object.entries(pageRotations)) {
    const pageIdx = Number(pageNumStr) - 1;
    if (pageIdx >= 0 && pageIdx < pages.length && rotation) {
      pages[pageIdx].setRotation(degrees(rotation));
    }
  }

  // Embed fonts
  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    HelveticaItalic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    HelveticaBoldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    TimesRomanBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    TimesRomanItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    TimesRomanBoldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
    CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
    CourierItalic: await pdfDoc.embedFont(StandardFonts.CourierOblique),
    CourierBoldItalic: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
  };

  const getFont = (family, isBold, isItalic) => {
    let fontName = family || 'Helvetica';
    if (family === 'TimesRoman') {
      if (isBold && isItalic) fontName = 'TimesRomanBoldItalic';
      else if (isBold) fontName = 'TimesRomanBold';
      else if (isItalic) fontName = 'TimesRomanItalic';
    } else if (family === 'Courier') {
      if (isBold && isItalic) fontName = 'CourierBoldItalic';
      else if (isBold) fontName = 'CourierBold';
      else if (isItalic) fontName = 'CourierItalic';
    } else {
      if (isBold && isItalic) fontName = 'HelveticaBoldItalic';
      else if (isBold) fontName = 'HelveticaBold';
      else if (isItalic) fontName = 'HelveticaItalic';
    }
    return fonts[fontName] || fonts.Helvetica;
  };

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNum = i + 1;
    const pageAnns = annotations[pageNum];
    
    if (!pageAnns) continue;

    const { width, height } = page.getSize();

    // Helper for cropped images
    const getCroppedImageBytes = async (img) => {
      return new Promise((resolve) => {
        const cropW = img.cropPercentWidth ?? 1;
        const cropH = img.cropPercentHeight ?? 1;
        const cropX = img.cropPercentX ?? 0;
        const cropY = img.cropPercentY ?? 0;

        if (cropW === 1 && cropH === 1 && cropX === 0 && cropY === 0) {
          fetch(img.dataUrl).then(res => res.arrayBuffer()).then(resolve);
          return;
        }

        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width * cropW;
          canvas.height = image.height * cropH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, image.width * cropX, image.height * cropY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          const type = img.type === 'png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(blob => { blob.arrayBuffer().then(resolve); }, type);
        };
        image.src = img.dataUrl;
      });
    };

    // Helper to embed a data URL image
    const embedDataUrlImage = async (dataUrl) => {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);

      // Check if PNG or JPEG by looking at the data URL prefix or magic bytes
      if (dataUrl.includes('image/png') || bytes[0] === 0x89) {
        return await pdfDoc.embedPng(bytes);
      } else {
        return await pdfDoc.embedJpg(bytes);
      }
    };

    // === ERASURES (Whiteout) ===
    if (pageAnns.erasures) {
      for (const erase of pageAnns.erasures) {
        page.drawRectangle({
          x: erase.x / SCALE,
          y: height - (erase.y / SCALE) - (erase.height / SCALE),
          width: erase.width / SCALE,
          height: erase.height / SCALE,
          color: rgb(1, 1, 1),
        });
      }
    }

    // === HIGHLIGHTS ===
    if (pageAnns.highlights) {
      for (const hl of pageAnns.highlights) {
        const color = hexToRgb(hl.color || '#ffff00');
        page.drawRectangle({
          x: hl.x / SCALE,
          y: height - (hl.y / SCALE) - (hl.height / SCALE),
          width: hl.width / SCALE,
          height: hl.height / SCALE,
          color: rgb(color.r, color.g, color.b),
          opacity: hl.opacity || 0.4,
        });
      }
    }

    // === SHAPES ===
    if (pageAnns.shapes) {
      for (const shape of pageAnns.shapes) {
        const color = hexToRgb(shape.color || '#ef4444');
        const rgbColor = rgb(color.r, color.g, color.b);
        const sw = (shape.strokeWidth || 3) / SCALE;

        if (shape.type === 'rectangle') {
          page.drawRectangle({
            x: shape.x / SCALE,
            y: height - (shape.y / SCALE) - (shape.height / SCALE),
            width: shape.width / SCALE,
            height: shape.height / SCALE,
            borderColor: rgbColor,
            borderWidth: sw,
          });
        } else if (shape.type === 'circle') {
          // Approximate ellipse with a rectangle border (pdf-lib doesn't have ellipse)
          // Draw as 4 bezier curves forming an ellipse
          const cx = shape.x / SCALE + (shape.width / SCALE) / 2;
          const cy = height - (shape.y / SCALE) - (shape.height / SCALE) / 2;
          const rx = (shape.width / SCALE) / 2;
          const ry = (shape.height / SCALE) / 2;

          // Use SVG-style ellipse approximation with bezier curves
          const k = 0.5522848; // magic number for bezier circle approximation
          page.drawSvgPath(
            `M ${cx - rx} ${cy} ` +
            `C ${cx - rx} ${cy + ry * k}, ${cx - rx * k} ${cy + ry}, ${cx} ${cy + ry} ` +
            `C ${cx + rx * k} ${cy + ry}, ${cx + rx} ${cy + ry * k}, ${cx + rx} ${cy} ` +
            `C ${cx + rx} ${cy - ry * k}, ${cx + rx * k} ${cy - ry}, ${cx} ${cy - ry} ` +
            `C ${cx - rx * k} ${cy - ry}, ${cx - rx} ${cy - ry * k}, ${cx - rx} ${cy} Z`,
            {
              borderColor: rgbColor,
              borderWidth: sw,
              x: 0,
              y: height,
              scale: 1,
            }
          );
        } else if (shape.type === 'line' || shape.type === 'arrow') {
          const sx = (shape.startX ?? shape.x) / SCALE;
          const sy = height - ((shape.startY ?? shape.y) / SCALE);
          const ex = (shape.endX ?? (shape.x + shape.width)) / SCALE;
          const ey = height - ((shape.endY ?? (shape.y + shape.height)) / SCALE);

          page.drawLine({
            start: { x: sx, y: sy },
            end: { x: ex, y: ey },
            thickness: sw,
            color: rgbColor,
          });

          if (shape.type === 'arrow') {
            const angle = Math.atan2(ey - sy, ex - sx);
            const headLen = 12 / SCALE;
            page.drawLine({
              start: { x: ex, y: ey },
              end: { x: ex - headLen * Math.cos(angle - Math.PI / 6), y: ey - headLen * Math.sin(angle - Math.PI / 6) },
              thickness: sw,
              color: rgbColor,
            });
            page.drawLine({
              start: { x: ex, y: ey },
              end: { x: ex - headLen * Math.cos(angle + Math.PI / 6), y: ey - headLen * Math.sin(angle + Math.PI / 6) },
              thickness: sw,
              color: rgbColor,
            });
          }
        }
      }
    }

    // === IMAGES ===
    if (pageAnns.images) {
      for (const img of pageAnns.images) {
        let pdfImage;
        const imgBytes = await getCroppedImageBytes(img);
        if (img.type === 'png') {
          pdfImage = await pdfDoc.embedPng(imgBytes);
        } else {
          pdfImage = await pdfDoc.embedJpg(imgBytes);
        }
        page.drawImage(pdfImage, {
          x: img.x / SCALE,
          y: height - (img.y / SCALE) - (img.height / SCALE),
          width: img.width / SCALE,
          height: img.height / SCALE,
        });
      }
    }

    // === SIGNATURES ===
    if (pageAnns.signatures) {
      for (const sig of pageAnns.signatures) {
        try {
          const pdfImage = await embedDataUrlImage(sig.dataUrl);
          page.drawImage(pdfImage, {
            x: sig.x / SCALE,
            y: height - (sig.y / SCALE) - (sig.height / SCALE),
            width: sig.width / SCALE,
            height: sig.height / SCALE,
          });
        } catch (err) {
          console.error("Failed to embed signature:", err);
        }
      }
    }

    // === STAMPS ===
    if (pageAnns.stamps) {
      for (const stamp of pageAnns.stamps) {
        const font = fonts.HelveticaBold;
        const stampColor = hexToRgb(stamp.color || '#16a34a');
        const size = 22 / SCALE;
        const pdfX = stamp.x / SCALE;
        const pdfY = height - (stamp.y / SCALE);

        // Draw stamp border and text
        const textWidth = font.widthOfTextAtSize(stamp.label, size);
        const padding = 8 / SCALE;
        const borderThickness = 3 / SCALE;

        page.drawRectangle({
          x: pdfX - padding,
          y: pdfY - size - padding,
          width: textWidth + padding * 2,
          height: size + padding * 2,
          borderColor: rgb(stampColor.r, stampColor.g, stampColor.b),
          borderWidth: borderThickness,
          rotate: degrees(-15),
        });

        page.drawText(stamp.label, {
          x: pdfX,
          y: pdfY - size,
          size: size,
          font: font,
          color: rgb(stampColor.r, stampColor.g, stampColor.b),
          rotate: degrees(-15),
        });
      }
    }

    // === TEXTS ===
    if (pageAnns.texts) {
      for (const t of pageAnns.texts) {
        const pdfXBase = t.x / SCALE;
        const pdfYBase = height - (t.y / SCALE);

        const font = getFont(t.fontFamily, t.isBold, t.isItalic);
        const color = hexToRgb(t.color || '#3b82f6');
        const rgbColor = rgb(color.r, color.g, color.b);
        const size = t.fontSize || 16;

        const wrapText = (text, maxWidth, font, size) => {
          if (!maxWidth) return text.split('\n');
          const wrappedLines = [];
          const paragraphs = text.split('\n');
          for (const p of paragraphs) {
            const words = p.split(' ');
            let currentLine = '';
            for (const word of words) {
              const testLine = currentLine ? currentLine + ' ' + word : word;
              const testWidth = font.widthOfTextAtSize(testLine, size);
              if (testWidth > maxWidth && currentLine) {
                wrappedLines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) wrappedLines.push(currentLine);
          }
          return wrappedLines;
        };

        const maxPdfWidth = t.width ? t.width / SCALE : null;
        const lines = wrapText(t.text || '', maxPdfWidth, font, size);
        const lineHeight = size * 1.2;

        let maxTextWidth = 0;
        for (const line of lines) {
          maxTextWidth = Math.max(maxTextWidth, font.widthOfTextAtSize(line, size));
        }

        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          const textWidth = font.widthOfTextAtSize(line, size);
          const lineIndexFromBottom = (lines.length - 1) - j;
          const currentPdfY = pdfYBase + (lineIndexFromBottom * lineHeight);

          let offsetX = 0;
          if (t.alignment === 'center') offsetX = (maxTextWidth - textWidth) / 2;
          else if (t.alignment === 'right') offsetX = maxTextWidth - textWidth;

          page.drawText(line, {
            x: pdfXBase + offsetX,
            y: currentPdfY,
            size,
            font,
            color: rgbColor,
          });

          if (t.isUnderline) {
            const underlineY = currentPdfY - (size * 0.1);
            page.drawLine({
              start: { x: pdfXBase + offsetX, y: underlineY },
              end: { x: pdfXBase + offsetX + textWidth, y: underlineY },
              thickness: size * 0.05,
              color: rgbColor,
            });
          }
        }
      }
    }

    // === DRAWINGS ===
    if (pageAnns.paths) {
      for (const path of pageAnns.paths) {
        if (!path.points || path.points.length < 2) continue;
        const color = hexToRgb(path.color || '#ef4444');
        const sw = (path.width || 3) / SCALE;

        for (let j = 0; j < path.points.length - 1; j++) {
          const start = path.points[j];
          const end = path.points[j + 1];
          page.drawLine({
            start: { x: start.x / SCALE, y: height - (start.y / SCALE) },
            end: { x: end.x / SCALE, y: height - (end.y / SCALE) },
            thickness: sw,
            color: rgb(color.r, color.g, color.b),
          });
        }
      }
    }

    // === COMMENTS (as small text annotations) ===
    if (pageAnns.comments) {
      for (const comment of pageAnns.comments) {
        if (!comment.text) continue;
        // Draw a small note indicator
        const noteX = comment.x / SCALE;
        const noteY = height - (comment.y / SCALE);
        const noteColor = hexToRgb(comment.color || '#f59e0b');

        // Draw note icon background
        page.drawRectangle({
          x: noteX - 6,
          y: noteY - 6,
          width: 12,
          height: 12,
          color: rgb(noteColor.r, noteColor.g, noteColor.b),
        });

        // Add the comment text as a small annotation near the icon
        const font = fonts.Helvetica;
        const fontSize = 8;
        const lines = comment.text.split('\n').slice(0, 3); // Max 3 lines
        for (let li = 0; li < lines.length; li++) {
          page.drawText(lines[li].substring(0, 50), {
            x: noteX + 10,
            y: noteY - (li * 10),
            size: fontSize,
            font,
            color: rgb(0.3, 0.3, 0.3),
          });
        }
      }
    }
  }

  return await pdfDoc.save();
};
