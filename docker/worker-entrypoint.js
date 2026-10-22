/**
 * ALEX Background Worker
 * 
 * Handles:
 * - Document processing (extraction, chunking, embedding, indexing)
 * - Scheduled jobs (cleanup, attendance alerts, reports)
 * - Notification delivery
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Simple in-memory queue for demo; replace with BullMQ + Redis in production
const jobQueue = []
let isProcessing = false

async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return
  isProcessing = true
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()
    if (job) {
      try {
        await job()
      } catch (error) {
        console.error('Job failed:', error)
      }
    }
  }
  
  isProcessing = false
}

function enqueueJob(job) {
  jobQueue.push(job)
  processQueue()
}

// Scheduled jobs
async function cleanupOldNotifications() {
  console.log('[Worker] Running scheduled cleanup of old notifications')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      isRead: true,
    },
  })
  
  console.log(`[Worker] Cleaned up ${result.count} old notifications`)
}

async function attendanceAlerts() {
  console.log('[Worker] Running scheduled attendance alerts')
  
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', isActive: true },
    include: {
      memberships: { where: { status: 'ACTIVE' } },
    },
  })
  
  for (const student of students) {
    for (const membership of student.memberships) {
      if (!membership.semesterId) continue
      
      const sessions = await prisma.attendanceSession.findMany({
        where: {
          semesterId: membership.semesterId,
          isCancelled: false,
        },
        include: {
          records: { where: { userId: student.id } },
        },
      })
      
      let present = 0
      let total = 0
      
      for (const session of sessions) {
        const record = session.records[0]
        if (record) {
          total++
          if (record.status === 'PRESENT') present++
        }
      }
      
      if (total > 0) {
        const percentage = (present / total) * 100
        if (percentage < 35) {
          await prisma.notification.create({
            data: {
              userId: student.id,
              category: 'ATTENDANCE',
              title: 'Low Attendance Alert',
              message: `Your attendance is ${percentage.toFixed(1)}%. Please attend classes regularly.`,
              isRead: false,
            },
          })
          console.log(`[Worker] Attendance alert sent to ${student.email}: ${percentage.toFixed(1)}%`)
        }
      }
    }
  }
}

// Job scheduler
function startScheduler() {
  // Daily at 2 AM - cleanup old notifications
  scheduleJob('0 2 * * *', cleanupOldNotifications)
  
  // Daily at 8 AM - attendance alerts
  scheduleJob('0 8 * * *', attendanceAlerts)
  
  console.log('[Worker] Scheduler started')
}

function scheduleJob(cron, fn) {
  // Simple cron implementation - in production use node-cron or similar
  const [minute, hour, day, month, weekday] = cron.split(' ')
  
  setInterval(() => {
    const now = new Date()
    const matchMinute = minute === '*' || parseInt(minute, 10) === now.getMinutes()
    const matchHour = hour === '*' || parseInt(hour, 10) === now.getHours()
    const matchDay = day === '*' || parseInt(day, 10) === now.getDate()
    const matchMonth = month === '*' || parseInt(month, 10) === now.getMonth() + 1
    const matchWeekday = weekday === '*' || parseInt(weekday, 10) === now.getDay()
    
    if (matchMinute && matchHour && matchDay && matchMonth && matchWeekday) {
      fn().catch(console.error)
    }
  }, 60000) // Check every minute
}

if (require.main === module) {
  console.log('[Worker] Starting ALEX background worker...')
  startScheduler()

  // Keep process alive
  setInterval(() => {}, 1000 * 60 * 60)

  process.on('SIGTERM', async () => {
    console.log('[Worker] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down...')
    await prisma.$disconnect()
    process.exit(0)
  })
}

module.exports = {
  enqueueJob,
  scheduleJob,
}
