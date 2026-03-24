import { useApp } from '../../hooks/useApp'
import { formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy, localizeAgentName, localizeAgentRole, localizeAgentStatus, localizeAgentTask, localizeLogMessage } from '../../utils/market'
import type { AgentStatus } from '../../types'

const statusStyles: Record<AgentStatus, { dot: string; text: string; bg: string }> = {
  running: { dot: 'bg-profit animate-pulse', text: 'text-profit', bg: 'bg-profit/10' },
  idle: { dot: 'bg-warning', text: 'text-warning', bg: 'bg-warning/10' },
  error: { dot: 'bg-loss', text: 'text-loss', bg: 'bg-loss/10' },
  paused: { dot: 'bg-dark-muted', text: 'text-dark-muted', bg: 'bg-dark-muted/10' },
}

const agentIcons: Record<string, JSX.Element> = {
  researcher: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  strategist: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  risk_manager: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  executor: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  coordinator: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
}

export function AgentsPanel() {
  const { agents, logs, isLoading, marketType } = useApp()
  const copy = getDashboardCopy(marketType)

  if (isLoading) {
    return (
      <div className="h-full bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-dark-hover rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.agentMonitor}</h2>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-profit animate-pulse"></span>
          <span className="text-xs text-dark-muted">{copy.systemActive}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {/* Agent Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {agents.map((agent) => {
            const styles = statusStyles[agent.status]
            const icon = agentIcons[agent.role] || agentIcons.coordinator

            return (
              <div
                key={agent.id}
                className={`${styles.bg} flex min-h-[188px] flex-col rounded-lg p-3 border border-dark-border`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`${styles.text}`}>{icon}</div>
                    <div>
                      <div className="font-medium text-dark-text text-sm">{localizeAgentName(agent.name, marketType)}</div>
                      <div className="text-xs text-dark-muted capitalize">
                        {localizeAgentRole(agent.role, marketType)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
                    <span className={`text-xs ${styles.text} capitalize`}>{localizeAgentStatus(agent.status, marketType)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-dark-muted">{copy.tasks}: </span>
                    <span className="text-dark-text">{agent.taskCount}</span>
                  </div>
                  <div>
                    <span className="text-dark-muted">{copy.success}: </span>
                    <span className={agent.successRate >= 90 ? 'text-profit' : agent.successRate >= 70 ? 'text-warning' : 'text-loss'}>
                      {agent.successRate.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Current Task */}
                {agent.currentTask && (
                  <div className="mt-auto pt-2 border-t border-dark-border/50">
                    <div className="text-xs text-dark-muted truncate">
                      {localizeAgentTask(agent.currentTask, marketType)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Recent Activity Log */}
        <div className="mt-auto border-t border-dark-border pt-4">
          <div className="text-xs text-dark-muted uppercase tracking-wider mb-2">{copy.activityLog}</div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  log.level === 'success' ? 'bg-profit' :
                  log.level === 'error' ? 'bg-loss' :
                  log.level === 'warning' ? 'bg-warning' : 'bg-info'
                }`}></span>
                <div className="flex-1 min-w-0">
                  <span className="text-dark-muted">[{localizeAgentName(log.agentName, marketType)}]</span>{' '}
                  <span className="text-dark-text">{localizeLogMessage(log.message, marketType)}</span>
                </div>
                <span className="text-dark-muted flex-shrink-0">
                  {formatRelativeTime(log.timestamp, marketType)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
