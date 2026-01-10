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
    async function fetchData() {
      setLoading(true)
      const data = await getAllCustomers()
      setCustomers(data)
      setFilteredCustomers(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    if (!term) {
      setFilteredCustomers(customers)
      return
    }
    const results = await searchCustomers(term)
    setFilteredCustomers(results)
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

  const closeModal = () => setIsModalOpen(false)

  const onSubmit = async (values: CustomerFormValues) => {
    const payload: CustomerFormData = {
      name: values.name,
      doc: values.doc || undefined,
      phone: values.phone,
      email: values.email || undefined,
      address: values.address || undefined,
    }
    if (selectedCustomer) {
      await updateCustomer(selectedCustomer.id, payload)
    } else {
      await createCustomer(payload)
    }
    const data = await getAllCustomers()
    setCustomers(data)
    setFilteredCustomers(data)
    setIsModalOpen(false)
  }

  const handleEdit = (customer: Customer) => openModal(customer)

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return
    await deleteCustomer(id)
    const data = await getAllCustomers()
    setCustomers(data)
    setFilteredCustomers(data)
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button onClick={() => openModal()} className="btn btn-primary">Novo Cliente</button>
      </div>

      <div className="card p-4">
        <label className="form-label">Buscar</label>
        <input
          type="text"
          placeholder="Buscar por nome, doc, telefone ou email..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="form-input"
        />
      </div>

      {/* Mobile list (cards) */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">{customer.name}</p>
                <p className="text-sm text-gray-600 truncate">{customer.phone}</p>
                {customer.doc && <p className="text-sm text-gray-600 truncate">{customer.doc}</p>}
                {customer.email && <p className="text-sm text-gray-600 truncate">{customer.email}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => handleEdit(customer)} className="btn btn-secondary flex-1 min-w-[120px]">Editar</button>
              <button onClick={() => handleDelete(customer.id)} className="btn btn-danger flex-1 min-w-[120px]">Excluir</button>
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
                <th>Nome</th>
                <th>Telefone</th>
                <th>CPF/CNPJ</th>
                <th>Email</th>
                <th>Endereço</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.doc || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.address || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => handleEdit(customer)}
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label className="form-label">Nome</label>
                <input {...register('name')} className="form-input" />
                {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Telefone</label>
                  <input {...register('phone')} className="form-input" />
                  {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="form-label">CPF/CNPJ</label>
                  <input {...register('doc')} className="form-input" />
                </div>
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
              
              <div className="pt-2 flex gap-3">
                <button type="submit" className="btn btn-primary flex-1">
                  {selectedCustomer ? 'Salvar' : 'Criar'}
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
