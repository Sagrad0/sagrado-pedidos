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
  weight: z.number().optional(),
  price: z.number().min(0, 'Preço deve ser maior ou igual a zero'),
  active: z.boolean().optional(),
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
    loadProducts()
  }, [])

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredProducts(filtered)
    } else {
      setFilteredProducts(products)
    }
  }, [searchTerm, products])

  const loadProducts = async () => {
    try {
      const data = await getAllProducts()
      setProducts(data)
      setFilteredProducts(data)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (product?: Product) => {
    if (product) {
      setSelectedProduct(product)
      setValue('sku', product.sku)
      setValue('name', product.name)
      setValue('unit', product.unit)
      setValue('weight', product.weight || 0)
      setValue('price', product.price)
      setValue('active', product.active)
    } else {
      setSelectedProduct(null)
      reset({
        sku: '',
        name: '',
        unit: 'un',
        weight: 0,
        price: 0,
        active: true,
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedProduct(null)
    setIsModalOpen(false)
    reset()
  }

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (selectedProduct) {
        await updateProduct(selectedProduct.id, data)
      } else {
        await createProduct(data)
      }
      await loadProducts()
      closeModal()
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Erro ao salvar produto')
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      await toggleProductActive(product.id, product.active)
      await loadProducts()
    } catch (error) {
      console.error('Error toggling product:', error)
      alert('Erro ao alternar status do produto')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <button
          onClick={() => openModal()}
          className="btn btn-primary"
        >
          Novo Produto
        </button>
      </div>

      <div className="card p-4">
        <input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="card overflow-hidden">
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
          <tbody className="bg-white divide-y divide-gray-200">
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => openModal(product)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(product)}
                    className={`${
                      product.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {product.active ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">
              {selectedProduct ? 'Editar Produto' : 'Novo Produto'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="form-label">SKU *</label>
                <input {...register('sku')} className="form-input" />
                {errors.sku && <p className="text-red-500 text-sm">{errors.sku.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Nome *</label>
                <input {...register('name')} className="form-input" />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Unidade *</label>
                <select {...register('unit')} className="form-input">
                  <option value="un">un</option>
                  <option value="cx">cx</option>
                  <option value="kg">kg</option>
                  <option value="lt">lt</option>
                  <option value="mt">mt</option>
                </select>
                {errors.unit && <p className="text-red-500 text-sm">{errors.unit.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Peso (gramas)</label>
                <input
                  type="number"
                  {...register('weight', { valueAsNumber: true })}
                  className="form-input"
                />
              </div>
              
              <div>
                <label className="form-label">Preço *</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('price', { valueAsNumber: true })}
                  className="form-input"
                />
                {errors.price && <p className="text-red-500 text-sm">{errors.price.message}</p>}
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Salvar
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