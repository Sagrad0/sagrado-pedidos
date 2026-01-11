import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Order, OrderItem } from "@/types";

type PdfKind = "ORCAMENTO" | "PEDIDO";

// A4 (pdf-lib trabalha em pontos)
const A4 = { w: 595.28, h: 841.89 };
const M = 36;

export async function generateOrderPdf(
  order: Order,
  kind: PdfKind
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4.w, A4.h]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = A4.h - M;

  /* =========================
     CORES (paleta Sagrado)
  ========================== */
  const brand = rgb(244 / 255, 67 / 255, 157 / 255); // #F4439D
  const text = rgb(55 / 255, 65 / 255, 81 / 255);
  const border = rgb(229 / 255, 231 / 255, 235 / 255);

  /* =========================
     CABEÇALHO
  ========================== */

  // Marca
  page.drawText("SAGRADO", {
    x: M,
    y,
    size: 26,
    font: fontBold,
    color: brand,
  });

  y -= 28;

  // Tipo + número
  page.drawText(
    `${kind === "PEDIDO" ? "PEDIDO" : "ORÇAMENTO"} Nº ${order.number ?? "-"}`,
    {
      x: M,
      y,
      size: 14,
      font: fontBold,
      color: text,
    }
  );

  y -= 18;

  // Data
  page.drawText(`Data: ${order.createdAt ?? "-"}`, {
    x: M,
    y,
    size: 10,
    font: fontRegular,
    color: text,
  });

  y -= 22;

  // Linha
  page.drawLine({
    start: { x: M, y },
    end: { x: A4.w - M, y },
    thickness: 1,
    color: border,
  });

  y -= 16;

  /* =========================
     FATURANTE – CDA FOODS
  ========================== */

  page.drawText("Faturante:", {
    x: M,
    y,
    size: 10,
    font: fontBold,
    color: text,
  });

  y -= 14;

  const faturante = [
    "CDA Foods",
    "CNPJ: 00.874.798/0001-09",
    "Av. Liberdade, 500 – CEP 55014-580",
    "Tel: (81) 3723-8881",
    "administrativo@cdafoods.com.br",
  ];

  faturante.forEach((line) => {
    page.drawText(line, {
      x: M,
      y,
      size: 9,
      font: fontRegular,
      color: text,
    });
    y -= 12;
  });

  y -= 10;

  /* =========================
     CLIENTE
  ========================== */

  page.drawText("Cliente:", {
    x: M,
    y,
    size: 10,
    font: fontBold,
    color: text,
  });

  y -= 14;

  const cliente = [
    order.customer?.name ?? "-",
    order.customer?.document ? `Documento: ${order.customer.document}` : "",
    order.customer?.address ?? "",
    order.customer?.city ?? "",
    order.customer?.email ?? "",
  ].filter(Boolean);

  cliente.forEach((line) => {
    page.drawText(line, {
      x: M,
      y,
      size: 9,
      font: fontRegular,
      color: text,
    });
    y -= 12;
  });

  y -= 16;

  /* =========================
     TABELA DE ITENS
  ========================== */

  page.drawText("Itens do pedido", {
    x: M,
    y,
    size: 12,
    font: fontBold,
    color: text,
  });

  y -= 14;

  const headers = ["Produto", "Qtd", "Unit.", "Subtotal"];
  const cols = [M, M + 280, M + 340, M + 420];

  headers.forEach((h, i) => {
    page.drawText(h, {
      x: cols[i],
      y,
      size: 9,
      font: fontBold,
      color: text,
    });
  });

  y -= 8;

  page.drawLine({
    start: { x: M, y },
    end: { x: A4.w - M, y },
    thickness: 1,
    color: border,
  });

  y -= 12;

  order.items.forEach((item: OrderItem) => {
    page.drawText(item.name, {
      x: cols[0],
      y,
      size: 9,
      font: fontRegular,
      color: text,
      maxWidth: 260,
    });

    page.drawText(String(item.quantity), {
      x: cols[1],
      y,
      size: 9,
      font: fontRegular,
      color: text,
    });

    page.drawText(`R$ ${item.price.toFixed(2)}`, {
      x: cols[2],
      y,
      size: 9,
      font: fontRegular,
      color: text,
    });

    page.drawText(`R$ ${(item.price * item.quantity).toFixed(2)}`, {
      x: cols[3],
      y,
      size: 9,
      font: fontRegular,
      color: text,
    });

    y -= 14;
  });

  y -= 10;

  /* =========================
     RESUMO
  ========================== */

  page.drawLine({
    start: { x: M, y },
    end: { x: A4.w - M, y },
    thickness: 1,
    color: border,
  });

  y -= 16;

  page.drawText("Valor total:", {
    x: M + 300,
    y,
    size: 12,
    font: fontBold,
    color: text,
  });

  page.drawText(`R$ ${order.total.toFixed(2)}`, {
    x: M + 380,
    y,
    size: 14,
    font: fontBold,
    color: brand,
  });

  /* =========================
     FINALIZA
  ========================== */

  return await pdfDoc.save();
}
