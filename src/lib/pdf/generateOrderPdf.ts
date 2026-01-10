import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Order } from '@/types'

type PdfKind = 'ORCAMENTO' | 'PEDIDO'

const M = 36 // margin
const cSoft = rgb(0.97, 0.98, 0.99)
const cLine = rgb(0.85, 0.88, 0.92)
const cDark = rgb(0.13, 0.2, 0.3)
const cBlue = rgb(0.11, 0.4, 0.86)

export async function generateOrderPdf(order: Order) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Header bar
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: cSoft })

  const pdfBytes = await pdfDoc.save()

  /**
   * FIX TS/BlobPart:
   * Em alguns builds (Vercel/TS libs), o retorno tipa como Uint8Array<ArrayBufferLike>
   * e o BlobPart exige ArrayBuffer. A forma mais segura é copiar para um Uint8Array
   * "normal" (com ArrayBuffer), sem mudar dados e sem any espalhado.
   */
  const safeBytes = new Uint8Array(pdfBytes)

  const blob = new Blob([safeBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url

  const kind: PdfKind = order.status === 'pedido' ? 'PEDIDO' : 'ORCAMENTO'
  const prefix = kind === 'PEDIDO' ? 'PED' : 'ORC'

  const orderNumber = order.orderNumber || ''
  const fileNumber =
    orderNumber.startsWith('PED-') || orderNumber.startsWith('ORC-')
      ? orderNumber
      : `${prefix}-${orderNumber}`

  a.download = `${kind}_${fileNumber}.pdf`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}
