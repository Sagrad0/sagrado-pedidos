'use client'

import { useState, useEffect } from 'react'
import { Customer, CustomerFormData } from '@/types'
import { getAllCustomers, searchCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/db/customers'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const customerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  doc: z.string().optional(),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm) ||
          (c.doc && c.doc.includes(searchTerm))
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers(customers)
    }
  }, [searchTerm, customers])

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers()
      setCustomers(data)
      setFilteredCustomers(data)
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
  }

  const openModal = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer)
      setValue('name', customer.name)
      setValue('doc', customer.doc || '')
      setValue('phone', customer.phone)
      setValue('email', customer.email || '')
      setValue('address', customer.address || '')
    } else {
      setSelectedCustomer(null)
      reset()
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedCustomer(null)
    setIsModalOpen(false)
    reset()
  }

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, data)
      } else {
        await createCustomer(data)
      }
      await loadCustomers()
      closeModal()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Erro ao salvar cliente')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await deleteCustomer(id)
        await loadCustomers()
      } catch (error) {
        console.error('Error deleting customer:', error)
        alert('Erro ao excluir cliente')
      }
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button
          onClick={() => openModal()}
          className="btn btn-primary"
        >
          Novo Cliente
        </button>
      </div>

      <div className="card p-4">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>CPF/CNPJ</th>
              <th>Email</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {customer.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.doc || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => openModal(customer)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Excluir
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
              {selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="form-label">Nome *</label>
                <input {...register('name')} className="form-input" />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>
              
              <div>
                <label className="form-label">CPF/CNPJ</label>
                <input {...register('doc')} className="form-input" />
              </div>
              
              <div>
                <label className="form-label">Telefone *</label>
                <input {...register('phone')} className="form-input" />
                {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Email</label>
                <input {...register('email')} type="email" className="form-input" />
                {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>
              
              <div>
                <label className="form-label">Endereço</label>
                <input {...register('address')} className="form-input" />
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