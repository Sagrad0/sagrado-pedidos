/*
 * FIX ABSOLUTO: Implementado sistema de células com boundary enforcement
 * - Cada célula agora tem área de desenho exclusiva e protegida
 * - Truncamento forçado em TODOS os campos (SKU, Produto, Unit, Qtd, Preço, Total)
 * - Fonte reduzida e padding otimizado
 * - Sanitização completa de entrada para evitar NaN e valores inválidos
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { Order } from '@/types'
import { formatAddress } from '@/lib/address'

// ===== CONSTANTES =====
const A4_W = 595.28
const A4_H = 841.89
const M = 40
const W = A4_W - M * 2

// ✅ Currency local (sem import externo)
const formatCurrency = (v: number) => {
  const n = Number(v)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(n) ? n : 0
  )
}

// ===== CONFIGURAÇÃO DA TABELA =====
const TABLE_CONFIG = {
  columns: {
    idx: { width: 22, label: '#' },
    sku: { width: 80, label: 'SKU' },
    prod: { width: 205, label: 'PRODUTO' },
    unit: { width: 32, label: 'UN' },
    qty: { width: 40, label: 'QTD' },
    price: { width: 60, label: 'PREÇO' },
    total: { width: 70, label: 'TOTAL' },
  },
  rowHeight: 18,
  headerHeight: 22,
  fontSize: 7,
  headerFontSize: 7,
  cellPadding: 2,
}

// ===== SPACING =====
const SPACING = {
  sectionGap: 18,
  headerGap: 12,
  padding: 8,
}

// ===== FUNÇÕES UTILITÁRIAS =====
const safeNum = (v: any, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const safeStr = (v: any) => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const truncateText = (text: string, maxChars: number) => {
  if (!text) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

const calculateColumnX = (startX: number, widths: number[], index: number) => {
  return startX + widths.slice(0, index).reduce((a, b) => a + b, 0)
}

const sumOrderTotal = (order: any) => {
  if (order?.totals?.total != null) return safeNum(order.totals.total, 0)

  const items = Array.isArray(order?.items) ? order.items : []
  return items.reduce((acc: number, it: any) => {
    const qty = safeNum(it.qty ?? it.quantity, 0)
    const unitPrice = safeNum(it.unitPrice ?? it.price, 0)
    const lineTotal = it.total != null ? safeNum(it.total, qty * unitPrice) : qty * unitPrice
    return acc + lineTotal
  }, 0)
}

export async function generateOrderPdf(order: Order): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([A4_W, A4_H])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = A4_H - M

  // ===== HEADER =====
  const title = (order.status === 'orcamento')
    ? `ORÇAMENTO ${safeStr((order as any).budgetNumber || '')}`
    : `PEDIDO ${safeStr((order as any).orderNumber || (order as any).budgetNumber || '')}`

  page.drawText(title, {
    x: M,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  y -= 18

  const createdAt = safeStr((order as any).createdAt)
  page.drawText(`Data: ${createdAt ? new Date(Number(createdAt)).toLocaleDateString('pt-BR') : '-'}`, {
    x: M,
    y,
    size: 9,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })

  y -= SPACING.headerGap

  // ===== SECTIONS =====
  const drawSectionTitle = (t: string, x: number, y: number) => {
    page.drawText(t, { x, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  }

  const drawKV = (k: string, v: string, x: number, y: number, maxW: number) => {
    const label = `${k}: `
    page.drawText(label, { x, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(truncateText(v, Math.max(10, Math.floor(maxW / 4))), {
      x: x + fontBold.widthOfTextAtSize(label, 8),
      y,
      size: 8,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: maxW,
    })
  }

  // ===== CLIENTE =====
  drawSectionTitle('CLIENTE', M + 4, y)
  y -= 10

  const c: any = (order as any).customerSnapshot || {}

  const blockH = 70
  // bloco cinza
  page.drawRectangle({
    x: M,
    y: y - blockH,
    width: W,
    height: blockH,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  })

  const x1 = M + SPACING.padding
  const x2 = M + W / 2 + SPACING.padding
  const topY = y - 14

  drawKV('Nome', safeStr(c.name), x1, topY, W / 2 - SPACING.padding * 2)
  drawKV('Razão Social', safeStr((c as any).legalName), x1, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Documento', safeStr(c.doc), x1, topY - 36, W / 2 - SPACING.padding * 2)
  drawKV('Endereço Principal', truncateText(formatAddress((c as any).addressMain ?? (c as any).address), 90), x1, topY - 54, W / 2 - SPACING.padding * 2)

  drawKV('Telefone', safeStr(c.phone), x2, topY, W / 2 - SPACING.padding * 2)
  drawKV('E-mail', safeStr(c.email), x2, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Endereço Entrega', truncateText(formatAddress((c as any).addressDelivery), 90), x2, topY - 36, W / 2 - SPACING.padding * 2)

  y -= blockH + SPACING.sectionGap

  // ===== TABLE =====
  drawSectionTitle('ITENS DO PEDIDO', M + 4, y + 12)
  y -= 20

  const cols = Object.values(TABLE_CONFIG.columns)
  const widths = cols.map((c) => c.width)
  const startX = M

  const drawCell = (text: string, colIndex: number, rowY: number, isHeader = false) => {
    const x = calculateColumnX(startX, widths, colIndex)
    const w = widths[colIndex]
    const h = isHeader ? TABLE_CONFIG.headerHeight : TABLE_CONFIG.rowHeight

    // cell border
    page.drawRectangle({
      x,
      y: rowY - h,
      width: w,
      height: h,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
      color: isHeader ? rgb(0.94, 0.94, 0.94) : rgb(1, 1, 1),
    })

    const pad = TABLE_CONFIG.cellPadding
    const maxChars = Math.max(3, Math.floor((w - pad * 2) / 4))

    page.drawText(truncateText(text, maxChars), {
      x: x + pad,
      y: rowY - h + 6,
      size: isHeader ? TABLE_CONFIG.headerFontSize : TABLE_CONFIG.fontSize,
      font: isHeader ? fontBold : font,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: w - pad * 2,
    })
  }

  const drawTableHeader = (rowY: number) => {
    cols.forEach((c, idx) => drawCell(c.label, idx, rowY, true))
    return rowY - TABLE_CONFIG.headerHeight
  }

  const drawTableRow = (rowY: number, row: string[]) => {
    row.forEach((v, idx) => drawCell(v, idx, rowY, false))
    return rowY - TABLE_CONFIG.rowHeight
  }

  y = drawTableHeader(y)

  const items = Array.isArray((order as any).items) ? (order as any).items : []
  items.forEach((it: any, index: number) => {
    const qty = safeNum(it.qty ?? it.quantity, 0)
    const unitPrice = safeNum(it.unitPrice ?? it.price, 0)
    const lineTotal = it.total != null ? safeNum(it.total, qty * unitPrice) : qty * unitPrice

    const row = [
      String(index + 1),
      safeStr(it.productSnapshot?.sku ?? it.sku),
      safeStr(it.productSnapshot?.name ?? it.name),
      safeStr(it.productSnapshot?.unit ?? it.unit),
      String(qty),
      formatCurrency(unitPrice),
      formatCurrency(lineTotal),
    ]

    y = drawTableRow(y, row)

    // quebra página
    if (y < M + 140) {
      const newPage = pdfDoc.addPage([A4_W, A4_H])
      ;(page as any) = newPage
      y = A4_H - M
      y = drawTableHeader(y)
    }
  })

  // ===== TOTAL =====
  y -= 18
  drawSectionTitle('TOTAL', M + 4, y + 12)
  y -= 8

  const total = sumOrderTotal(order)
  page.drawText(`Total: ${formatCurrency(total)}`, {
    x: M,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  const bytes = await pdfDoc.save()
  return bytes
}
