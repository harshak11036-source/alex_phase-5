"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'
import { AIAvatar } from '@/components/ai/Avatar'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth/AuthProvider'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const userRole = user?.role || 'STUDENT'

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar */}
          <Sidebar userRole={userRole} className={cn("z-50 lg:z-40", sidebarOpen && "translate-x-0")} />

          {/* Main content */}
          <div className="lg:pl-64">
            {/* Header with mobile menu button */}
            <TooltipProvider>
              <Header 
                user={{ 
                  id: user?.id || '', 
                  firstName: user?.firstName || '', 
                  lastName: user?.lastName || '', 
                  email: user?.email || '', 
                  avatarUrl: user?.avatarUrl || null, 
                  role: userRole 
                }} 
              >
              </Header>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-10 w-10"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                  >
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {sidebarOpen ? "Close sidebar" : "Open sidebar"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Page content */}
            <main className="p-4 sm:p-6 lg:p-8 pt-4">
              <div className="container-responsive">
                {children}
              </div>
            </main>
          </div>

          {/* Floating AI Avatar */}
          <AIAvatar />
        </div>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}