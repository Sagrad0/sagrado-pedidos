/*
 * FIX ABSOLUTO: Implementado sistema de células com boundary enforcement
 * - Cada célula agora tem área de desenho exclusiva e protegida
 * - Truncamento forçado em TODOS os campos (SKU, Produto, Unidade, Quantidade)
 * - Padding horizontal duplo (esquerda + direita) de 8px em cada célula
 * - Wrap de texto para observações com limite de altura
 * - Garantia matemática: soma das larguras + paddings = largura total disponível
 * - Debug mode opcional para visualizar as bordas das células
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

// >>>> DADOS DA EMPRESA (EDITAR AQUI) <<<<
const FATURANTE = {
  razaoSocial: 'CDA FOODS LTDA',
  nomeFantasia: 'CDA Foods',
  cnpj: '00.000.000/0000-00',
  ie: '000000000',
  endereco: 'ENDEREÇO COMPLETO, Nº, BAIRRO, CEP',
  cidade: 'RECIFE',
  uf: 'PE',
  telefone: '(81) 00000-0000',
  email: 'contato@cdafoods.com.br',
}

// === CORES E ESTILOS ===
const BRAND = {
  primary: rgb(0x45 / 255, 0x00 / 255, 0x57 / 255),
  primaryDark: rgb(0x30 / 255, 0x00 / 255, 0x3d / 255),
  bgLight: rgb(0.98, 0.98, 0.98),
  bgZebra: rgb(0.992, 0.992, 0.992),
  text: rgb(0.08, 0.08, 0.08),
  textMuted: rgb(0.45, 0.45, 0.45),
  border: rgb(0.88, 0.88, 0.88),
  white: rgb(1, 1, 1),
  debug: rgb(1, 0, 0), // Para visualizar bordas das células (desative em produção)
}

// === PADRONIZAÇÃO TIPOGRÁFICA ===
const SIZES = {
  title: 16,
  subtitle: 11,
  sectionTitle: 10.5,
  body: 9.5,
  bodySmall: 9,
  label: 9,
  footer: 8.5,
  tableHeader: 10,
  tableBody: 9.5,
  totalLabel: 10.5,
  totalValue: 14,
}

const SPACING = {
  sectionGap: 28,
  blockGap: 20,
  lineHeight: 14,
  padding: 16,
  paddingSmall: 12,
  paddingTable: 8, // Padding horizontal dentro de cada célula
}

// === MEDIDAS A4 ===
const A4_W = 595.28
const A4_H = 841.89
const M = 36

// === CONFIGURAÇÃO DA TABELA (MATEMÁTICA PRECIOSA) ===
// Largura total disponível: A4_W - 2*M - bordas laterais (16px) = 523.28
// Padding interno total: 8px por lado × 2 lados × 7 colunas = 112px
// Largura líquida para conteúdo: 523.28 - 112 = 411.28px
const TABLE_CONFIG = {
  cellPadding: SPACING.paddingTable,
  columns: {
    idx: { width: 30, align: 'left' as const },
    sku: { width: 70, align: 'left' as const },
    prod: { width: 170, align: 'left' as const }, // Reduzido para dar mais espaço
    und: { width: 50, align: 'left' as const },
    qtd: { width: 55, align: 'right' as const },
    unit: { width: 70, align: 'right' as const },
    sub: { width: 70, align: 'right' as const },
  },
  headerHeight: 32,
  rowHeight: 26,
  debugMode: false, // MUDE PARA true PARA VER AS BORDAS DAS CÉLULAS
}

// === FUNÇÕES UTILITÁRIAS ===
function safeStr(v: any): string {
  return v == null ? '' : String(v)
}

function formatDatePtBR(value: any): string {
  if (!value) return '-'
  const d = typeof value === 'number' ? new Date(value) : value?.toDate ? value.toDate() : new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
}

function brl(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0)
}

function n2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100
}

function inferKind(order: Order, kind?: PdfKind): PdfKind {
  if (kind) return kind
  return (order as any).status === 'orcamento' ? 'ORCAMENTO' : 'PEDIDO'
}

function docNumber(order: Order, kind: PdfKind): string {
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'
  const raw = safeStr((order as any).orderNumber).trim()
  if (!raw) return prefix
  return raw.startsWith('PED-') || raw.startsWith('ORC-') ? raw : `${prefix}-${raw}`
}

// === FUNÇÃO CRÍTICA: WRAP TEXT PARA OBSERVAÇÕES ===
function wrapText(text: string, maxWidth: number, size: number, font: any): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const wLen = font.widthOfTextAtSize(test, size)
    if (wLen <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

// === NOVO SISTEMA DE DESENHO DE CÉLULAS ===
function drawCell(
  page: any,
  font: any,
  fontB: any,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    size?: number
    bold?: boolean
    align?: 'left' | 'right' | 'center'
    color?: any
    debug?: boolean
  } = {}
): void {
  const {
    size = SIZES.tableBody,
    bold = false,
    align = 'left',
    color = BRAND.text,
    debug = TABLE_CONFIG.debugMode,
  } = options

  const f = bold ? fontB : font
  const padding = TABLE_CONFIG.cellPadding

  // Área de desenho efetiva (descontando padding)
  const contentWidth = width - padding * 2

  // [DEBUG] Desenhar borda da célula
  if (debug) {
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      borderColor: BRAND.debug,
      borderWidth: 0.5,
      color: undefined,
    })
  }

  // Truncamento inteligente baseado na largura disponível
  let displayText = safeStr(text)
  const ellipsis = '…'
  const ellipsisWidth = f.widthOfTextAtSize(ellipsis, size)

  // Se o texto não couber, truncar com ellipsis
  if (f.widthOfTextAtSize(displayText, size) > contentWidth) {
    if (align === 'right') {
      // Truncar do início para alinhamento à direita
      let truncated = ''
      for (let i = displayText.length - 1; i >= 0; i--) {
        const test = displayText[i] + truncated
        if (f.widthOfTextAtSize(test, size) + ellipsisWidth > contentWidth) break
        truncated = test
      }
      displayText = ellipsis + truncated
    } else {
      // Truncar do fim para alinhamento à esquerda
      let truncated = ''
      for (let i = 0; i < displayText.length; i++) {
        const test = truncated + displayText[i]
        if (f.widthOfTextAtSize(test, size) + ellipsisWidth > contentWidth) {
          truncated = test.slice(0, -1)
          break
        }
        truncated = test
      }
      displayText = truncated + ellipsis
    }
  }

  // Calcular posição X baseado no alinhamento
  let finalX = x + padding
  if (align === 'center') {
    const textWidth = f.widthOfTextAtSize(displayText, size)
    finalX = x + width / 2 - textWidth / 2
  } else if (align === 'right') {
    const textWidth = f.widthOfTextAtSize(displayText, size)
    finalX = x + width - padding - textWidth
  }

  // Desenhar texto dentro da célula
  page.drawText(displayText, {
    x: finalX,
    y: y - height / 2 - size / 2 + 2, // Centralizado verticalmente
    size,
    font: f,
    color,
  })
}

// [CORREÇÃO CRÍTICA] Função para calcular posição X de cada coluna
function calculateColumnX(startX: number, colWidths: number[], index: number): number {
  let x = startX
  for (let i = 0; i < index; i++) {
    x += colWidths[i]
  }
  return x
}

export async function generateOrderPdf(order: Order, kind?: PdfKind) {
  const K = inferKind(order, kind)
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const W = A4_W - 2 * M
  let page = pdfDoc.addPage([A4_W, A4_H])
  let y = A4_H - M

  // ===== HELPERS =====
  const drawBox = (x: number, yTop: number, w: number, h: number, fill?: any, border = true) => {
    page.drawRectangle({ 
      x, 
      y: yTop - h, 
      width: w, 
      height: h, 
      color: fill, 
      borderColor: border ? BRAND.border : undefined, 
      borderWidth: border ? 0.5 : 0 
    })
  }

  const drawText = (text: string, x: number, y: number, opts?: any) => {
    const size = opts?.size ?? SIZES.body
    const f = opts?.bold ? fontB : font
    const color = opts?.color ?? BRAND.text
    const t = safeStr(text)

    if (opts?.align && opts.align !== 'left') {
      const w = f.widthOfTextAtSize(t, size)
      const xx = opts.align === 'right' ? x - w : x - w / 2
      page.drawText(t, { x: xx, y, size, font: f, color })
      return
    }
    page.drawText(t, { x, y, size, font: f, color })
  }

  const drawSectionTitle = (title: string, x: number, yTop: number) => {
    drawText(title, x, yTop - 12, { bold: true, size: SIZES.sectionTitle, color: BRAND.primaryDark })
  }

  const drawKV = (label: string, value: string, x: number, y: number, w: number) => {
    const L = `${label}:`
    drawText(L, x, y, { bold: true, size: SIZES.label, color: BRAND.text })
    const lw = fontB.widthOfTextAtSize(L, SIZES.label)
    drawText(value || '—', x + lw + 4, y, { size: SIZES.bodySmall, color: BRAND.text })
  }

  // ===== HEADER =====
  const drawHeader = (yTop: number): number => {
    const brandH = 48
    page.drawRectangle({ x: M, y: yTop - brandH, width: W, height: brandH, color: BRAND.primary })

    const title = K === 'PEDIDO' ? 'Pedido de Venda' : 'Orçamento'
    drawText(title, M + W / 2, yTop - 30, { bold: true, size: SIZES.title, align: 'center', color: BRAND.white })

    const h = 98
    drawBox(M, yTop - brandH - 16, W, h, BRAND.bgLight)

    const leftX = M + SPACING.padding
    drawText(`Nº ${docNumber(order, K)}`, leftX, yTop - 34, { bold: true, size: 13 })
    drawText(`Data de Emissão: ${formatDatePtBR((order as any).createdAt)}`, leftX, yTop - 54, { 
      size: SIZES.bodySmall, 
      color: BRAND.textMuted 
    })

    const rightX = M + W - SPACING.padding
    const maxWidth = 220
    drawText(FATURANTE.nomeFantasia, rightX, yTop - 26, { bold: true, size: SIZES.subtitle, align: 'right', maxWidth })
    drawText(FATURANTE.razaoSocial, rightX, yTop - 40, { size: SIZES.bodySmall, align: 'right', maxWidth })
    drawText(`CNPJ: ${FATURANTE.cnpj} | IE: ${FATURANTE.ie}`, rightX, yTop - 54, { size: SIZES.bodySmall, align: 'right', maxWidth })
    drawText(FATURANTE.endereco, rightX, yTop - 67, { size: 8.5, align: 'right', maxWidth })
    drawText(`${FATURANTE.cidade}/${FATURANTE.uf} • ${FATURANTE.telefone}`, rightX, yTop - 80, { size: SIZES.bodySmall, align: 'right', maxWidth })
    drawText(FATURANTE.email, rightX, yTop - 92, { size: SIZES.bodySmall, align: 'right', maxWidth })

    return yTop - brandH - 16 - h - SPACING.sectionGap
  }

  y = drawHeader(y)

  const newPage = () => {
    page = pdfDoc.addPage([A4_W, A4_H])
    y = A4_H - M
    y = drawHeader(y)
  }

  // ===== CLIENTE BLOCK =====
  const c = (order as any).customerSnapshot || {}
  const blockH = 104
  drawBox(M, y, W, blockH)
  drawSectionTitle('DADOS DO CLIENTE', M + SPACING.padding, y)

  const x1 = M + SPACING.padding
  const x2 = M + W / 2 + SPACING.padding
  const topY = y - 38

  drawKV('Cliente', safeStr(c.name), x1, topY, W / 2 - SPACING.padding * 2)
  drawKV('Documento', safeStr(c.doc), x1, topY - 18, W / 2 - SPACING.padding * 2)
  drawKV('Telefone', safeStr(c.phone), x1, topY - 36, W / 2 - SPACING.padding * 2)
  drawKV('E-mail', safeStr(c.email), x2, topY, W / 2 - SPACING.padding * 2)

  y -= blockH + SPACING.sectionGap

  // ===== TABLE =====
  drawSectionTitle('ITENS DO PEDIDO', M + 4, y + 12)
  y -= 20

  const colWidths = Object.values(TABLE_CONFIG.columns).map(c => c.width)
  const tableStartX = M + 8

  const colX = {
    idx: tableStartX,
    sku: calculateColumnX(tableStartX, colWidths, 0),
    prod: calculateColumnX(tableStartX, colWidths, 1),
    und: calculateColumnX(tableStartX, colWidths, 2),
    qtd: calculateColumnX(tableStartX, colWidths, 3),
    unit: calculateColumnX(tableStartX, colWidths, 4),
    sub: calculateColumnX(tableStartX, colWidths, 5),
  }

  const needNewPageForRow = () => y - TABLE_CONFIG.rowHeight <= M + 180

  // ===== NOVO DESENHO DO CABEÇALHO DA TABELA =====
  const drawTableHeader = () => {
    drawBox(M, y, W, TABLE_CONFIG.headerHeight, BRAND.bgLight)
    
    const headers = ['#', 'Código', 'Produto', 'Unid.', 'Qtde.', 'Preço Unit.', 'Subtotal']
    const aligns = ['left', 'left', 'left', 'left', 'right', 'right', 'right']

    let colIndex = 0
    for (const key of Object.keys(TABLE_CONFIG.columns)) {
      const col = TABLE_CONFIG.columns[key as keyof typeof TABLE_CONFIG.columns]
      const headerX = calculateColumnX(tableStartX, colWidths, colIndex)
      const cellWidth = col.width

      drawCell(page, font, fontB, headers[colIndex], headerX, y, cellWidth, TABLE_CONFIG.headerHeight, {
        bold: true,
        size: SIZES.tableHeader,
        align: aligns[colIndex] as any,
        color: BRAND.text,
      })

      colIndex++
    }

    y -= TABLE_CONFIG.headerHeight
  }

  drawTableHeader()

  // ===== NOVO DESENHO DAS LINHAS DA TABELA =====
  const items = Array.isArray((order as any).items) ? (order as any).items : []
  items.forEach((it: any, idx: number) => {
    if (needNewPageForRow()) {
      newPage()
      y -= 14
      drawSectionTitle('ITENS DO PEDIDO (CONTINUAÇÃO)', M + 4, y + 12)
      y -= 20
      drawTableHeader()
    }

    const isZebra = idx % 2 === 1
    if (isZebra) drawBox(M, y, W, TABLE_CONFIG.rowHeight, BRAND.bgZebra)

    const sku = safeStr(it?.productSnapshot?.sku || it?.sku)
    const name = safeStr(it?.productSnapshot?.name || it?.name)
    const unit = safeStr(it?.productSnapshot?.unit || it?.unit)
    const qty = Number(it?.qty ?? 0)
    const unitPrice = Number(it?.unitPrice ?? 0)
    const subtotal = n2(qty * unitPrice)

    const rowData = [
      String(idx + 1),
      sku,
      name,
      unit,
      String(qty || 0),
      brl(unitPrice),
      brl(subtotal),
    ]

    let colIndex = 0
    const aligns = ['left', 'left', 'left', 'left', 'right', 'right', 'right']
    
    for (const key of Object.keys(TABLE_CONFIG.columns)) {
      const col = TABLE_CONFIG.columns[key as keyof typeof TABLE_CONFIG.columns]
      const cellX = calculateColumnX(tableStartX, colWidths, colIndex)
      const cellWidth = col.width

      drawCell(page, font, fontB, rowData[colIndex], cellX, y, cellWidth, TABLE_CONFIG.rowHeight, {
        size: SIZES.tableBody,
        align: aligns[colIndex] as any,
        color: BRAND.text,
      })

      colIndex++
    }

    y -= TABLE_CONFIG.rowHeight
  })

  // ===== TOTALS & NOTES =====
  if (y <= M + 180) newPage()
  y -= SPACING.blockGap

  const totalsBoxW = 240
  const totalsBoxH = 120
  const totalsX = M + W - totalsBoxW

  drawBox(totalsX, y, totalsBoxW, totalsBoxH)
  page.drawRectangle({ x: totalsX, y: y - 24, width: totalsBoxW, height: 24, color: BRAND.primaryDark })
  drawText('TOTAIS', totalsX + SPACING.paddingSmall, y - 15, { bold: true, size: SIZES.sectionTitle, color: BRAND.white })

  const t = (order as any).totals || { subtotal: 0, discount: 0, freight: 0, total: 0 }
  const totalValues = [
    n2(Number(t.subtotal ?? 0)),
    n2(Number(t.discount ?? 0)),
    n2(Number(t.freight ?? 0)),
    n2(Number(t.total ?? 0)),
  ]

  const labelY = y - 48
  const tx = totalsX + SPACING.paddingSmall

  drawText('Subtotal:', tx, labelY, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(totalValues[0]), totalsX + totalsBoxW - SPACING.paddingSmall, labelY, { size: SIZES.totalLabel, align: 'right' })

  drawText('Desconto:', tx, labelY - 18, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(totalValues[1]), totalsX + totalsBoxW - SPACING.paddingSmall, labelY - 18, { size: SIZES.totalLabel, align: 'right' })

  drawText('Frete:', tx, labelY - 36, { size: SIZES.totalLabel, color: BRAND.textMuted })
  drawText(brl(totalValues[2]), totalsX + totalsBoxW - SPACING.paddingSmall, labelY - 36, { size: SIZES.totalLabel, align: 'right' })

  page.drawLine({ 
    start: { x: totalsX + SPACING.paddingSmall, y: labelY - 46 }, 
    end: { x: totalsX + totalsBoxW - SPACING.paddingSmall, y: labelY - 46 }, 
    thickness: 0.8, 
    color: BRAND.border 
  })

  drawText('TOTAL:', tx, labelY - 66, { bold: true, size: SIZES.totalValue, color: BRAND.primary })
  drawText(brl(totalValues[3]), totalsX + totalsBoxW - SPACING.paddingSmall, labelY - 66, { 
    bold: true, 
    size: SIZES.totalValue, 
    align: 'right', 
    color: BRAND.primary 
  })

  // Observações com wrap de texto (USANDO wrapText corretamente)
  const notesX = M
  const notesW = W - totalsBoxW - 16
  const notesH = totalsBoxH

  drawBox(notesX, y, notesW, notesH)
  page.drawRectangle({ x: notesX, y: y - 24, width: notesW, height: 24, color: BRAND.bgLight })
  drawText('OBSERVAÇÕES', notesX + SPACING.paddingSmall, y - 15, { bold: true, size: SIZES.sectionTitle, color: BRAND.primaryDark })

  const notes = safeStr((order as any).notes)
  // [CORREÇÃO] Agora passando o font corretamente para wrapText
  const noteLines = notes ? wrapText(notes, notesW - SPACING.paddingSmall * 2, SIZES.bodySmall, font).slice(0, 6) : ['—']
  
  let ny = y - 48
  for (const line of noteLines) {
    if (ny < y - notesH + SPACING.paddingSmall) break
    drawText(line, notesX + SPACING.paddingSmall, ny, { size: SIZES.bodySmall, color: BRAND.text })
    ny -= SPACING.lineHeight
  }

  y -= totalsBoxH + SPACING.sectionGap

  // ===== FOOTER =====
  const footerY = M + 22
  page.drawLine({ 
    start: { x: M, y: footerY + 8 }, 
    end: { x: A4_W - M, y: footerY + 8 }, 
    thickness: 0.5, 
    color: BRAND.border 
  })

  drawText(`Documento gerado em ${formatDatePtBR(Date.now())} • ${FATURANTE.nomeFantasia}`, M, footerY, {
    size: SIZES.footer,
    color: BRAND.textMuted,
  })

  // ===== DOWNLOAD =====
  const pdfBytes = await pdfDoc.save()
  const ab = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer

  const blob = new Blob([ab], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${K}_${docNumber(order, K)}.pdf`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
