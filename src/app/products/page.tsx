'use client'

import { useState, useEffect } from 'react'
import { Product, ProductFormData } from '@/types'
import { getAllProducts, searchProducts, createProduct, updateProduct, toggleProductActive } from '@/lib/db/products'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const productSchema = z.object({
  sku: z.string().min(1, 'SKU é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  weight: z.number().optional().or(z.nan()),
  price: z.number().min(0, 'Preço inválido'),
  active: z.boolean().default(true),
})

type ProductFormValues = z.infer<typeof productSchema>

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  })

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const data = await getAllProducts()
      setProducts(data)
      setFilteredProducts(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts(products)
    } else {
      const t = searchTerm.toLowerCase()
      setFilteredProducts(
        products.filter(
          (p) =>
            p.name.toLowerCase().includes(t) ||
            p.sku.toLowerCase().includes(t)
        )
      )
    }
  }, [searchTerm, products])

  const openModal = (product?: Product) => {
    if (product) {
      setSelectedProduct(product)
      setValue('sku', product.sku)
      setValue('name', product.name)
      setValue('unit', product.unit)
      setValue('weight', product.weight || (undefined as any))
      setValue('price', product.price)
      setValue('active', product.active)
    } else {
      setSelectedProduct(null)
      reset()
    }
    setIsModalOpen(true)
  }

  const closeModal = () => setIsModalOpen(false)

  const onSubmit = async (values: any) => {
    const payload: ProductFormData = {
      sku: values.sku,
      name: values.name,
      unit: values.unit,
      weight: values.weight || undefined,
      price: Number(values.price),
      active: Boolean(values.active),
    }
    if (selectedProduct) {
      await updateProduct(selectedProduct.id, payload)
    } else {
      await createProduct(payload)
    }
    const data = await getAllProducts()
    setProducts(data)
    setFilteredProducts(data)
    setIsModalOpen(false)
  }

  const handleEdit = (product: Product) => openModal(product)

  const handleToggleActive = async (product: Product) => {
    await toggleProductActive(product.id, !product.active)
    const data = await getAllProducts()
    setProducts(data)
    setFilteredProducts(data)
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <button onClick={() => openModal()} className="btn btn-primary">Novo Produto</button>
      </div>

      <div className="card p-4">
        <label className="form-label">Buscar</label>
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
        />
      </div>

      {/* Mobile list (cards) */}
      <div className="md:hidden space-y-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">{product.sku} — {product.name}</p>
                <p className="text-sm text-gray-600">R$ {product.price.toFixed(2)} • {product.unit}{product.weight ? ` • ${product.weight}g` : ''}</p>
                <span className={"inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full " + (product.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700")}>
                  {product.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => handleEdit(product)} className="btn btn-secondary flex-1 min-w-[120px]">Editar</button>
              <button onClick={() => handleToggleActive(product)} className="btn btn-primary flex-1 min-w-[120px]">
                {product.active ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nome</th>
                <th>Unidade</th>
                <th>Peso (g)</th>
                <th>Preço</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.weight || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R$ {product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={product.active ? 'text-green-700' : 'text-gray-500'}>
                      {product.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className="text-gray-700 hover:text-gray-900"
                    >
                      {product.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selectedProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">SKU</label>
                  <input {...register('sku')} className="form-input" />
                  {errors.sku && <p className="text-red-500 text-sm">{errors.sku.message}</p>}
                </div>
                <div>
                  <label className="form-label">Nome</label>
                  <input {...register('name')} className="form-input" />
                  {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Unidade</label>
                  <input {...register('unit')} className="form-input" />
                  {errors.unit && <p className="text-red-500 text-sm">{errors.unit.message}</p>}
                </div>
                <div>
                  <label className="form-label">Peso (g)</label>
                  <input type="number" step="1" {...register('weight', { valueAsNumber: true })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Preço</label>
                  <input type="number" step="0.01" {...register('price', { valueAsNumber: true })} className="form-input" />
                  {errors.price && <p className="text-red-500 text-sm">{errors.price.message}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...register('active')} />
                <span className="text-sm text-gray-700">Ativo</span>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="submit" className="btn btn-primary flex-1">
                  {selectedProduct ? 'Salvar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
