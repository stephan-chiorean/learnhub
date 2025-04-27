import { useState, useCallback } from 'react'

interface UseSidebarReturn {
  isSidebarOpen: boolean
  toggleSidebar: () => void
}

const useSidebar = (): UseSidebarReturn => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  return {
    isSidebarOpen,
    toggleSidebar,
  }
}

export default useSidebar 