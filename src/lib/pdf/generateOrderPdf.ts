import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Order } from '@/types'

/**
 * PDF V2 — Layout comercial (Orçamento/Pedido) + thumbnails de produto
 *
 * Imagens (fallback em cascata):
 * 1) item.productSnapshot.imageUrl (futuro Firebase)
 * 2) /products/<SKU>.png (public)
 * 3) placeholder
 */

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

const BRAND = {
  title: 'SAGRADO',
  // Se quiser trocar depois: coloque seu logo em /public/brand/logo.png e ajuste aqui
  logoUrl: '/icons/icon-192x192.png',
}

function brl(value: number) {
  const v = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(v)
}

function fmtDate(ts: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function safeText(s: any) {
  return typeof s === 'string' ? s : s == null ? '' : String(s)
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
  } catch {
    return null
  }
}

async function embedImage(pdfDoc: PDFDocument, url: string) {
  const bytes = await fetchBytes(url)
  if (!bytes) return null

  // tentativa simples: PNG primeiro; se falhar, tenta JPG
  try {
    return await pdfDoc.embedPng(bytes)
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes)
    } catch {
      return null
    }
  }
}

function getPdfKind(order: Order): PdfKind {
  return order.status === 'pedido' ? 'PEDIDO' : 'ORCAMENTO'
}

function getDocPrefix(kind: PdfKind) {
  return kind === 'PEDIDO' ? 'PED' : 'ORC'
}

function normalizeOrderNumber(kind: PdfKind, orderNumber: string) {
  // Se você ainda não implementou ORC-/PED- no contador,
  // a gente força no PDF (sem mexer no banco).
  const prefix = getDocPrefix(kind) + '-'
  const n = safeText(orderNumber).trim()
  if (!n) return prefix + '000000'
  if (n.startsWith('PED-') || n.startsWith('ORC-')) return n
  if (n.startsWith(prefix)) return n
  // Se vier tipo "PED-000001" beleza; se vier "PED-000001" já retorna acima.
  // Se vier "PED-000001"? ok.
  return prefix + n.replace(/^([A-Z]{3}-)?/, '')
}

export async function generateOrderPdf(order: Order): Promise<Uint8Array> {
  const kind = getPdfKind(order)
  const docPrefix = getDocPrefix(kind)
  const docNumber = normalizeOrderNumber(kind, order.orderNumber)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Paleta neutra “documento”
  const cText = rgb(0.12, 0.12, 0.12)
  const cMuted = rgb(0.38, 0.38, 0.38)
  const cLine = rgb(0.87, 0.87, 0.87)
  const cSoft = rgb(0.96, 0.96, 0.96)
  const cBadge = kind === 'PEDIDO' ? rgb(0.16, 0.55, 0.32) : rgb(0.18, 0.42, 0.75)

  const M = 38
  let y = height - M

  // ===== HEADER =====
  // barra superior
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: cSoft })
  page.drawLine({ start: { x: 0, y: height - 86 }, end: { x: width, y: height - 86 }, thickness: 1, color: cLine })

  // logo
  const logo = await embedImage(pdfDoc, BRAND.logoUrl)
  if (logo) {
    const size = 40
    page.drawImage(logo, { x: M, y: height - 66, width: size, height: size })
  } else {
    // fallback: caixinha
    page.drawRectangle({ x: M, y: height - 66, width: 40, height: 40, borderWidth: 1, borderColor: cLine })
    page.drawText('LOGO', { x: M + 8, y: height - 44, size: 9, font, color: cMuted })
  }

  // título
  page.drawText(`${BRAND.title}`, { x: M + 54, y: height - 42, size: 16, font: bold, color: cText })
  page.drawText(`${kind}`, { x: M + 54, y: height - 62, size: 12, font: bold, color: cMuted })

 
  // meta do documento (topo direito)
  const metaX = width - M - 220
  page.drawText(`Nº: ${docNumber}`, { x: metaX, y: height - 24, size: 10, font: bold, color: cText })
  page.drawText(`Data: ${fmtDate(order.createdAt)}`, { x: metaX, y: height - 38, size: 10, font, color: cMuted })
  page.drawText(`Status: ${safeText(order.status)}`, { x: metaX, y: height - 52, size: 10, font, color: cMuted })

  y = height - 104

  // ===== BLOCO CLIENTE / EMITENTE =====
  const boxH = 92
  const gap = 10
  const colW = (width - 2 * M - gap) / 2

  // Emitente
  page.drawRectangle({ x: M, y: y - boxH, width: colW, height: boxH, borderWidth: 1, borderColor: cLine })
  page.drawRectangle({ x: M, y: y - 22, width: colW, height: 22, color: cSoft })
  page.drawText('EMITENTE', { x: M + 10, y: y - 16, size: 10, font: bold, color: cText })

  page.drawText('Sagrado', { x: M + 10, y: y - 40, size: 11, font: bold, color: cText })
  page.drawText('Contato: —', { x: M + 10, y: y - 56, size: 10, font, color: cMuted })
  page.drawText('Cidade/UF: —', { x: M + 10, y: y - 70, size: 10, font, color: cMuted })
  page.drawText('E-mail: —', { x: M + 10, y: y - 84, size: 10, font, color: cMuted })

  // Cliente
  const cx = M + colW + gap
  page.drawRectangle({ x: cx, y: y - boxH, width: colW, height: boxH, borderWidth: 1, borderColor: cLine })
  page.drawRectangle({ x: cx, y: y - 22, width: colW, height: 22, color: cSoft })
  page.drawText('CLIENTE', { x: cx + 10, y: y - 16, size: 10, font: bold, color: cText })

  const cs = order.customerSnapshot
  page.drawText(safeText(cs?.name), { x: cx + 10, y: y - 40, size: 11, font: bold, color: cText })
  page.drawText(`Doc: ${safeText(cs?.doc)}`, { x: cx + 10, y: y - 56, size: 10, font, color: cMuted })
  page.drawText(`Tel: ${safeText(cs?.phone)}`, { x: cx + 10, y: y - 70, size: 10, font, color: cMuted })
  page.drawText(`End: ${safeText(cs?.address)}`, { x: cx + 10, y: y - 84, size: 10, font, color: cMuted })

  y -= (boxH + 18)

  // ===== TABELA ITENS =====
  page.drawText('ITENS', { x: M, y, size: 12, font: bold, color: cText })
  y -= 10

  const tableX = M
  const tableW = width - 2 * M

  // Header da tabela
  const headerH = 26
  page.drawRectangle({ x: tableX, y: y - headerH, width: tableW, height: headerH, color: cSoft, borderWidth: 1, borderColor: cLine })

  // Colunas
  const col = {
    idx: 22,
    img: 46,
    sku: 68,
    name: tableW - (22 + 46 + 68 + 54 + 70 + 74 + 76), // o que sobrar
    qty: 54,
    unit: 70,
    unitPrice: 74,
    total: 76,
  }

  let x = tableX
  const drawTh = (label: string, w: number, align: 'left' | 'right' = 'left') => {
    const pad = 8
    const tx = align === 'right' ? x + w - pad - font.widthOfTextAtSize(label, 9) : x + pad
    page.drawText(label, { x: tx, y: y - 18, size: 9, font: bold, color: cMuted })
    x += w
  }

  drawTh('#', col.idx)
  drawTh('Img', col.img)
  drawTh('SKU', col.sku)
  drawTh('Produto', col.name)
  drawTh('Qtd', col.qty, 'right')
  drawTh('Und', col.unit)
  drawTh('Unit', col.unitPrice, 'right')
  drawTh('Total', col.total, 'right')

  y -= headerH

  // Linhas
  const rowH = 44
  const imgSize = 34

  // Pré-carrega logo e tenta imagens por SKU (pra ficar rápido)
  const items = Array.isArray(order.items) ? order.items : []

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as any

    // quebra simples de página (sprint futuro: paginação completa)
    if (y < M + 180) break

    const isAlt = i % 2 === 1
    page.drawRectangle({
      x: tableX,
      y: y - rowH,
      width: tableW,
      height: rowH,
      color: isAlt ? rgb(0.985, 0.985, 0.985) : rgb(1, 1, 1),
      borderWidth: 1,
      borderColor: cLine,
    })

    // divisórias verticais
    let vx = tableX
    const cols = [col.idx, col.img, col.sku, col.name, col.qty, col.unit, col.unitPrice]
    for (const w of cols) {
      vx += w
      page.drawLine({ start: { x: vx, y: y - rowH }, end: { x: vx, y }, thickness: 1, color: cLine })
    }

    const sku = safeText(item.productSnapshot?.sku)
    const name = safeText(item.productSnapshot?.name)
    const unit = safeText(item.productSnapshot?.unit)
    const qty = Number(item.qty ?? 0)
    const unitPrice = Number(item.unitPrice ?? 0)
    const total = Number(item.total ?? qty * unitPrice)

    // idx
    page.drawText(String(i + 1), { x: tableX + 8, y: y - 26, size: 10, font, color: cText })

    // imagem
    const imgX = tableX + col.idx + 6
    const imgY = y - rowH + 5

    // 1) futuro: imageUrl no snapshot
    const imageUrl =
      safeText(item.productSnapshot?.imageUrl) ||
      safeText(item.productSnapshot?.image) ||
      safeText(item.imageUrl) ||
      safeText(item.image)

    // 2) fallback: arquivo em public por SKU
    const skuLocalPng = sku ? `/products/${encodeURIComponent(sku)}.png` : ''
    const skuLocalJpg = sku ? `/products/${encodeURIComponent(sku)}.jpg` : ''

    let embedded = null
    if (imageUrl) embedded = await embedImage(pdfDoc, imageUrl)
    if (!embedded && skuLocalPng) embedded = await embedImage(pdfDoc, skuLocalPng)
    if (!embedded && skuLocalJpg) embedded = await embedImage(pdfDoc, skuLocalJpg)

    if (embedded) {
      page.drawRectangle({ x: imgX, y: imgY, width: imgSize, height: imgSize, borderWidth: 1, borderColor: cLine })
      page.drawImage(embedded, { x: imgX + 1, y: imgY + 1, width: imgSize - 2, height: imgSize - 2 })
    } else {
      // placeholder
      page.drawRectangle({ x: imgX, y: imgY, width: imgSize, height: imgSize, borderWidth: 1, borderColor: cLine, color: cSoft })
      page.drawText('—', { x: imgX + 14, y: imgY + 12, size: 14, font: bold, color: cMuted })
    }

    // sku
    page.drawText(sku, { x: tableX + col.idx + col.img + 8, y: y - 18, size: 9, font: bold, color: cText })

    // nome (quebra manual simples)
    const nameX = tableX + col.idx + col.img + col.sku + 8
    const maxW = col.name - 16
    const nameSize = 10
    const words = name.split(' ').filter(Boolean)
    let line = ''
    let lines: string[] = []
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, nameSize) <= maxW) line = test
      else {
        if (line) lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    lines = lines.slice(0, 2)

    page.drawText(lines[0] ?? '', { x: nameX, y: y - 24, size: nameSize, font, color: cText })
    page.drawText(lines[1] ?? '', { x: nameX, y: y - 36, size: 9, font, color: cMuted })

    // qty (right)
    const qtyText = String(qty)
    const qtyX = tableX + col.idx + col.img + col.sku + col.name + col.qty - 8 - font.widthOfTextAtSize(qtyText, 10)
    page.drawText(qtyText, { x: qtyX, y: y - 26, size: 10, font: bold, color: cText })

    // unit
    page.drawText(unit, { x: tableX + col.idx + col.img + col.sku + col.name + col.qty + 8, y: y - 26, size: 10, font, color: cText })

    // unitPrice (right)
    const up = brl(unitPrice)
    const upX =
      tableX +
      col.idx +
      col.img +
      col.sku +
      col.name +
      col.qty +
      col.unit +
      col.unitPrice -
      8 -
      font.widthOfTextAtSize(up, 10)
    page.drawText(up, { x: upX, y: y - 26, size: 10, font, color: cText })

    // total (right)
    const tt = brl(total)
    const ttX =
      tableX +
      col.idx +
      col.img +
      col.sku +
      col.name +
      col.qty +
      col.unit +
      col.unitPrice +
      col.total -
      8 -
      font.widthOfTextAtSize(tt, 10)
    page.drawText(tt, { x: ttX, y: y - 26, size: 10, font: bold, color: cText })

    y -= rowH
  }

  y -= 14

  // ===== TOTAIS =====
  const totals = order.totals || ({} as any)
  const subtotal = Number(totals.subtotal ?? 0)
  const discount = Number(totals.discount ?? 0)
  const freight = Number(totals.freight ?? 0)
  const total = Number(totals.total ?? subtotal - discount + freight)

  const totalsW = 240
  const totalsH = 96
  const totalsX = width - M - totalsW
  const totalsY = y - totalsH

  page.drawRectangle({ x: totalsX, y: totalsY, width: totalsW, height: totalsH, borderWidth: 1, borderColor: cLine })
  page.drawRectangle({ x: totalsX, y: totalsY + totalsH - 22, width: totalsW, height: 22, color: cSoft })
  page.drawText('TOTAIS', { x: totalsX + 10, y: totalsY + totalsH - 16, size: 10, font: bold, color: cText })

  const lx = totalsX + 10
  const rx = totalsX + totalsW - 10

  const drawRow = (label: string, value: string, yy: number, strong = false) => {
    page.drawText(label, { x: lx, y: yy, size: 10, font: strong ? bold : font, color: strong ? cText : cMuted })
    const vx = rx - font.widthOfTextAtSize(value, 10)
    page.drawText(value, { x: vx, y: yy, size: 10, font: strong ? bold : font, color: strong ? cText : cText })
  }

  let ty = totalsY + totalsH - 38
  drawRow('Subtotal', brl(subtotal), ty)
  ty -= 16
  drawRow('Desconto', brl(discount), ty)
  ty -= 16
  drawRow('Frete', brl(freight), ty)

  page.drawLine({
    start: { x: totalsX, y: totalsY + 22 },
    end: { x: totalsX + totalsW, y: totalsY + 22 },
    thickness: 1,
    color: cLine,
  })

  drawRow('Total', brl(total), totalsY + 8, true)

  // ===== OBS / CONDIÇÕES =====
  const notes = safeText(order.notes).trim()

  const box2Y = totalsY - 90
  page.drawRectangle({ x: M, y: box2Y, width: width - 2 * M, height: 78, borderWidth: 1, borderColor: cLine })
  page.drawRectangle({ x: M, y: box2Y + 56, width: width - 2 * M, height: 22, color: cSoft })
  page.drawText('CONDIÇÕES / OBSERVAÇÕES', { x: M + 10, y: box2Y + 62, size: 10, font: bold, color: cText })

  const legal =
    kind === 'ORCAMENTO'
      ? 'Este documento é um ORÇAMENTO e não representa compromisso de faturamento. Valores e condições sujeitos à aprovação.'
      : 'Este documento é um PEDIDO confirmado conforme condições acordadas. Alterações somente mediante novo pedido.'

  page.drawText(legal, { x: M + 10, y: box2Y + 42, size: 9, font, color: cMuted, maxWidth: width - 2 * M - 20 })

  if (notes) {
    page.drawText(`Obs: ${notes}`, {
      x: M + 10,
      y: box2Y + 18,
      size: 9,
      font,
      color: cText,
      maxWidth: width - 2 * M - 20,
    })
  }

  // ===== FOOTER =====
  page.drawLine({ start: { x: M, y: 40 }, end: { x: width - M, y: 40 }, thickness: 1, color: cLine })
  page.drawText(`${BRAND.title} • Documento ${docPrefix} • Gerado em ${fmtDate(Date.now())}`, {
    x: M,
    y: 28,
    size: 9,
    font,
    color: cMuted,
  })

  return await pdfDoc.save()
}

export function downloadOrderPdf(order: Order, pdfBytes: Uint8Array) {
  // Normaliza para evitar conflito de tipagem (ArrayBufferLike/SharedArrayBuffer)
  const bytes = new Uint8Array(pdfBytes)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const kind = order.status === 'pedido' ? 'PEDIDO' : 'ORCAMENTO'
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const fileNumber = (order.orderNumber || '').startsWith('PED-') || (order.orderNumber || '').startsWith('ORC-')
    ? order.orderNumber
    : `${prefix}-${order.orderNumber}`
  a.download = `${kind}_${fileNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
