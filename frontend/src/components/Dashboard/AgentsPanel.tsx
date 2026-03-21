import React from 'react'
import { useApp } from '../hooks/useApp'
import { Agent } from '../hooks/useApp'

export function AgentsPanel() {
  const { agents, isLoading } = useApp()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  const getStatusStyles = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          dot: 'bg-green-400 animate-pulse'
        }
      case 'error':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          dot: 'bg-red-400'
        }
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          dot: 'bg-gray-400'
        }
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'researcher':
        return (
          <svg className="w-6 h-6" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-2a7 7 0 11 7 0 011 3 0 011-3-3.23a2 3 3 3 3 4 4 3 0 6-2 3 0 6 2 3 0 6-2 3 0-2 2 3-3 6-2m2-2a3 3 5 5 5 5 5 5 5-.9 0-.9 0-.9 0-.9 0-2 2-2 2h3M19 16v1M3 5a2 2 0 0 4 4 1 00 1.5.7 2.3 1 3-3 1-3 3-3 3 0-1.5-.7l2.3-1.7 1.7 1.7 2.3.7-1.5.7-2.3 1.7-1.7 1.7-2.3-.7 1.5-.7h3M19 16v1z" />
          </svg>
        )
      case 'strategist':
        return (
          <svg className="w-6 h-6" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 0-3-1 0 0-1.5.7-2.3 1.7-1.7 1.7-2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7h3M9 5v6a2 2 0 0-3 1 0 0 1.5-.7 2.3-1.7 1.7-1.7 2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7zM14 13l-2.5-2.5a2 2 0 0 3 0 3 0 0 0-2.5-2.5a2 2 0 0 3 0 3 0 0 0 2 2-2h3.5l1.5 1.5 0 2 2 0 0 3 0 3 0 0 0-2-2z" />
          </svg>
        )
      case 'risk_manager':
        return (
          <svg className="w-6 h-6" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 6a2 2 0 0-3 1 0 0-1.5.7-2.3 1.7-1.7 1.7-2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7h3M9 5a2 2 0 0-3 1 0 0 1.5-.7 2.3-1.7 1.7-1.7 2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7z" />
          </svg>
        )
      case 'executor':
        return (
          <svg className="w-6 h-6" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 4m3 0l4-4m6 6a2 2 0 0-3 1 0 0-1.5.7-2.3 1.7-1.7 1.7-2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7h3M13 5a2 2 0 0-3 1 0 0 1.5-.7 2.3-1.7 1.7-1.7 2.3.7 1.5.7 2.3-1.7 1.7-1.7 2.3-.7-1.5-.7z" />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1.25-3M9 20l3-1.25M3 9l-3-1.25L9 9l1.25-3 3-1.25" />
          </svg>
        )
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Status</h3>
      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => {
          const styles = getStatusStyles(agent.status)
          return (
            <div key={agent.name} className={`${styles.bg} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getRoleIcon(agent.role)}
                  <div>
                    <span className="font-medium text-gray-900">{agent.name}</span>
                    <span className={`text-xs ${styles.text}`}>
                      {agent.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`}></span>
                  <span className={`text-xs capitalize ${styles.text}`}>{agent.status}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <div>Tasks completed: {agent.taskCount}</div>
                <div>Last activity: {new Date(agent.lastActivity).toLocaleTimeString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
