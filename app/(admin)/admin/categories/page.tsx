'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Search, Edit, Trash2, GripVertical, Package } from 'lucide-react'

type Category = {
  id: string
  name: string
  slug: string
  courseCount: number
  order: number
  isActive: boolean
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [selected, setSelected] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  // Only name & slug in form
  const [form, setForm] = useState({
    name: '',
    slug: '',
  })

  // Reusable authenticated fetch
  const authFetch = async (input: string, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
  }

  const fetchCategories = async () => {
    try {
      const res = await authFetch('/api/categories?limit=1000', {
        credentials: 'include',
        next: { tags: ['categories'] },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCategories(data.categories.sort((a: Category, b: Category) => a.order - b.order))
    } catch {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // Auto-generate slug from name
  useEffect(() => {
    if (form.name && !form.slug) {
      const generated = form.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      setForm(prev => ({ ...prev, slug: generated }))
    }
  }, [form.name])

  // CREATE
  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await authFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          order: categories.length,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create')
      }

      const { category } = await res.json()
      setCategories(prev => [...prev, category])
      toast.success('Category created!')
      setOpenCreate(false)
      setForm({ name: '', slug: '' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // UPDATE
  const handleUpdate = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await authFetch('/api/categories', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selected.id,
          name: form.name,
          slug: form.slug,
        }),
      })

      if (!res.ok) throw new Error()
      const { category } = await res.json()
      setCategories(prev => prev.map(c => c.id === selected.id ? category : c))
      toast.success('Category updated!')
      setOpenEdit(false)
    } catch {
      toast.error('Failed to update')
    } finally {
      setSaving(false)
    }
  }

  // DELETE (soft)
  const handleDelete = async () => {
    if (!selected) return
    try {
      const res = await authFetch('/api/categories', {
        method: 'DELETE',
        body: JSON.stringify({ id: selected.id }),
      })

      if (!res.ok) throw new Error()
      setCategories(prev => prev.filter(c => c.id !== selected.id))
      toast.success('Category hidden')
      setOpenDelete(false)
    } catch {
      toast.error('Failed to delete')
    }
  }

  // REORDER
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(categories)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setCategories(items)

    try {
      const res = await authFetch('/api/categories/reorder', {
        method: 'POST',
        body: JSON.stringify(items.map((cat, i) => ({ id: cat.id, order: i }))),
      })

      if (!res.ok) throw new Error()
      toast.success('Order saved!')
    } catch {
      toast.error('Failed to save order')
      fetchCategories()
    }
  }

  const openEditModal = (cat: Category) => {
    setSelected(cat)
    setForm({ name: cat.name, slug: cat.slug })
    setOpenEdit(true)
  }

  const filtered = categories.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase()) ||
    cat.slug.includes(search.toLowerCase())
  )

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-heading-1 mb-2 text-dark dark:text-white">
          Categories
        </h1>
        <p className="text-body-2xlg text-dark-5 dark:text-dark-6">
          Manage course categories
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-5 dark:text-dark-6" 
          />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
          />
        </div>
        <Button 
          onClick={() => { setForm({ name: '', slug: '' }); setOpenCreate(true) }} 
          size="lg"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Category
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card 
              key={i}
              className="bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3"
            >
              <CardHeader>
                <Skeleton className="h-8 w-3/4 bg-gray-3 dark:bg-dark-3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full bg-gray-3 dark:bg-dark-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              >
                {filtered.map((cat, index) => (
                  <Draggable key={cat.id} draggableId={cat.id} index={index}>
                    {(provided, snapshot) => (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`relative transition-all hover:shadow-lg ${
                          snapshot.isDragging ? 'shadow-2xl rotate-1' : ''
                        } ${!cat.isActive ? 'opacity-60' : ''} bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3`}
                        style={{
                          boxShadow: snapshot.isDragging 
                            ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
                            : undefined,
                        }}
                      >
                        <div 
                          {...provided.dragHandleProps} 
                          className="absolute left-2 top-2 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-5 w-5 text-dark-5 dark:text-dark-6" />
                        </div>

                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg text-dark dark:text-white">
                              {cat.name}
                            </CardTitle>
                            <Badge 
                              className={cat.isActive 
                                ? "bg-green text-white" 
                                : "bg-gray-4 dark:bg-dark-4 text-white"
                              }
                            >
                              {cat.isActive ? 'Active' : 'Hidden'}
                            </Badge>
                          </div>
                          <CardDescription className="text-dark-5 dark:text-dark-6">
                            /{cat.slug}
                          </CardDescription>
                        </CardHeader>

                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-dark-5 dark:text-dark-6">
                            <Package className="h-4 w-4" />
                            {cat.courseCount} courses
                          </div>

                          <div className="flex gap-2 mt-6">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => openEditModal(cat)}
                              className="border-stroke dark:border-dark-3 text-dark dark:text-white bg-transparent hover:bg-gray-2 dark:hover:bg-dark-3"
                            >
                              <Edit className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setSelected(cat); setOpenDelete(true) }}
                              className="bg-red hover:bg-red/90 text-white"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Create Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3">
          <DialogHeader>
            <DialogTitle className="text-dark dark:text-white">
              Create Category
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-dark dark:text-white">
                Name
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Web Development"
                className="border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug" className="text-dark dark:text-white">
                Slug(-)
              </Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="web-development"
                className="border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpenCreate(false)}
              className="border-stroke dark:border-dark-3 text-dark dark:text-white bg-transparent hover:bg-gray-2 dark:hover:bg-dark-3"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={saving || !form.name || !form.slug}
              className="bg-primary hover:bg-primary/90 text-white disabled:bg-dark-5 dark:disabled:bg-dark-4"
            >
              {saving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-md bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3">
          <DialogHeader>
            <DialogTitle className="text-dark dark:text-white">
              Edit Category
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-dark dark:text-white">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-dark dark:text-white">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="border-stroke dark:border-dark-3 bg-transparent text-dark dark:text-white dark:bg-dark-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpenEdit(false)}
              className="border-stroke dark:border-dark-3 text-dark dark:text-white bg-transparent hover:bg-gray-2 dark:hover:bg-dark-3"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white disabled:bg-dark-5 dark:disabled:bg-dark-4"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent className="bg-gray-1 dark:bg-gray-dark border-stroke dark:border-dark-3">
          <DialogHeader>
            <DialogTitle className="text-dark dark:text-white">
              Hide Category?
            </DialogTitle>
            <DialogDescription className="text-dark-5 dark:text-dark-6">
              This will hide the category from students. Courses remain unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOpenDelete(false)}
              className="border-stroke dark:border-dark-3 text-dark dark:text-white bg-transparent hover:bg-gray-2 dark:hover:bg-dark-3"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="bg-red hover:bg-red/90 text-white"
            >
              Hide Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}