"use client"

import { useState, useEffect } from "react"
import { Users, Plus, Pencil, Trash2, Shield, Eye, AlertCircle, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth, isAdmin as checkIsAdmin } from "@/hooks/useAuth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type UserRole = 'admin' | 'analyst'

interface User {
  id: number
  email: string
  name: string
  role: UserRole
  created_at: string
  updated_at: string
}

interface UserFormData {
  email: string
  name: string
  role: UserRole
  password: string
}

export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth(true)
  const userIsAdmin = checkIsAdmin(currentUser)
  const { toast } = useToast()
  
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    name: '',
    role: 'analyst',
    password: ''
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({})

  // Load users on mount
  useEffect(() => {
    if (userIsAdmin) {
      loadUsers()
    }
  }, [userIsAdmin])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setUsers(data.users)
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to load users"
        })
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users"
      })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (isEdit: boolean = false): boolean => {
    const errors: Partial<Record<keyof UserFormData, string>> = {}
    
    if (!formData.email) {
      errors.email = "Email is required"
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        errors.email = "Invalid email format"
      }
    }
    
    if (!formData.name) {
      errors.name = "Name is required"
    }
    
    if (!isEdit && !formData.password) {
      errors.password = "Password is required"
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters"
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateUser = async () => {
    if (!validateForm()) return
    
    try {
      setSaving(true)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "User created successfully"
        })
        setCreateDialogOpen(false)
        resetForm()
        loadUsers()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create user"
        })
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create user"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser || !validateForm(true)) return
    
    try {
      setSaving(true)
      
      const updateData: any = {
        id: selectedUser.id,
        email: formData.email,
        name: formData.name,
        role: formData.role
      }
      
      // Only include password if it was changed
      if (formData.password) {
        updateData.password = formData.password
      }
      
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "User updated successfully"
        })
        setEditDialogOpen(false)
        setSelectedUser(null)
        resetForm()
        loadUsers()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update user"
        })
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    
    try {
      setSaving(true)
      const response = await fetch(`/api/users?id=${selectedUser.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "User deleted successfully"
        })
        setDeleteDialogOpen(false)
        setSelectedUser(null)
        loadUsers()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to delete user"
        })
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete user"
      })
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      password: ''
    })
    setFormErrors({})
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      role: 'analyst',
      password: ''
    })
    setFormErrors({})
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </main>
    )
  }

  // Access denied for non-admin users
  if (!userIsAdmin) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card className="glass-card border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-foreground">Access Denied</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    You don&apos;t have permission to manage users
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Admin Role Required:</strong> Only administrators can manage users.
                </AlertDescription>
              </Alert>
              <div className="pt-4">
                <Button variant="outline" onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-2">Manage user accounts and permissions</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setCreateDialogOpen(true)
            }}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* Users Table */}
        <Card className="glass-card border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-border/50">
                      <TableCell className="font-medium text-foreground">
                        {user.name}
                        {currentUser && user.id === currentUser.id && (
                          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                          className={`transition-colors ${
                            user.role === 'admin' 
                              ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/40' 
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/40'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <><Shield className="w-3 h-3 mr-1" />Admin</>
                          ) : (
                            <><Eye className="w-3 h-3 mr-1" />Analyst</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            className="h-8 w-8 p-0 hover:bg-secondary"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            disabled={!!(currentUser && user.id === currentUser.id)}
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="glass-modal sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New User</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add a new user to the system. Choose their role carefully.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="glass-card border-border/50"
                />
                {formErrors.name && (
                  <p className="text-xs text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="glass-card border-border/50"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="glass-card border-border/50"
                />
                {formErrors.password && (
                  <p className="text-xs text-destructive">{formErrors.password}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role" className="text-foreground">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="glass-card border-border/50">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="glass-modal">
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Admin - Full access
                      </div>
                    </SelectItem>
                    <SelectItem value="analyst">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-400" />
                        Analyst - Read-only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="glass-card border-border/50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {saving ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="glass-modal sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit User</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update user information. Leave password blank to keep current.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-foreground">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="glass-card border-border/50"
                />
                {formErrors.name && (
                  <p className="text-xs text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email" className="text-foreground">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="glass-card border-border/50"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password" className="text-foreground">
                  New Password <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave blank to keep current"
                  className="glass-card border-border/50"
                />
                {formErrors.password && (
                  <p className="text-xs text-destructive">{formErrors.password}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role" className="text-foreground">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="glass-card border-border/50">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="glass-modal">
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Admin - Full access
                      </div>
                    </SelectItem>
                    <SelectItem value="analyst">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-400" />
                        Analyst - Read-only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="glass-card border-border/50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditUser}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="glass-modal">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete User</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete <strong>{selectedUser?.name}</strong>? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="glass-card border-border/50">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={saving}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {saving ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}
