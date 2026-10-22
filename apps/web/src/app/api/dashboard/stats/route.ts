import { requireAuth } from '@/lib/auth'
import { prisma, serializeBigInt } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role === 'ADMIN') {
      const [
        totalStudents,
        totalLecturers,
        activeSubjects,
        totalDepartments,
        recentUsers,
        pendingMemberships,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
        prisma.user.count({ where: { role: 'LECTURER', isActive: true } }),
        prisma.subject.count(),
        prisma.department.count(),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.collegeMembership.findMany({
          where: { status: 'PENDING' },
          take: 5,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            department: { select: { name: true, code: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      return NextResponse.json({
        role: 'ADMIN',
        stats: {
          totalStudents,
          totalLecturers,
          activeSubjects,
          totalDepartments,
        },
        recentRegistrations: recentUsers,
        pendingApprovals: pendingMemberships,
      })
    }

    if (user.role === 'LECTURER') {
      const assignedSubjects = await prisma.subject.findMany({
        where: { lecturers: { some: { userId: user.id } } },
        include: {
          _count: { select: { enrollments: true } },
        },
      })
      const subjectIds = assignedSubjects.map(s => s.id)
      const activeStudents = assignedSubjects.reduce((sum, s) => sum + s._count.enrollments, 0)

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      const [
        todaysSessions,
        ungradedSubmissions,
        recentNotifications,
      ] = await Promise.all([
        prisma.attendanceSession.findMany({
          where: {
            subjectId: { in: subjectIds },
            date: { gte: startOfDay, lte: endOfDay },
          },
          include: {
            subject: { select: { id: true, name: true, code: true } },
            _count: { select: { records: true } },
          },
          orderBy: { period: 'asc' },
        }),
        prisma.assignmentSubmission.findMany({
          where: {
            assignment: { subjectId: { in: subjectIds } },
            status: { in: ['SUBMITTED', 'LATE', 'RESUBMITTED'] },
          },
          include: {
            assignment: {
              select: {
                id: true,
                title: true,
                subject: { select: { code: true, name: true } },
              },
            },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        }),
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

      const pendingAttendance = todaysSessions.filter(s => s._count.records === 0).length

      return NextResponse.json({
        role: 'LECTURER',
        stats: {
          assignedSubjects: assignedSubjects.length,
          pendingAttendance,
          ungradedSubmissions: ungradedSubmissions.length,
          activeStudents,
        },
        todaysClasses: todaysSessions,
        pendingSubmissions: ungradedSubmissions.slice(0, 5),
        recentAnnouncements: recentNotifications,
      })
    }

    // Default: STUDENT / PROJECT_MENTOR
    const [
      documentsCount,
      recentDocuments,
      studyMaterialsCount,
      activeProjectsCount,
      upcomingAssignments,
      upcomingTasks,
      enrollmentsWithAttendance,
    ] = await Promise.all([
      prisma.document.count({ where: { ownerId: user.id } }),
      prisma.document.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          fileName: true,
          documentType: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.studyMaterial.count({ where: { userId: user.id } }),
      prisma.project.count({
        where: {
          OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
          status: { in: ['PLANNING', 'ACTIVE'] },
        },
      }),
      prisma.assignment.findMany({
        where: {
          isPublished: true,
          dueDate: { gte: new Date() },
          subject: { enrollments: { some: { userId: user.id, isActive: true } } },
        },
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.task.findMany({
        where: {
          assigneeId: user.id,
          isCompleted: false,
          dueDate: { gte: new Date() },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.subjectEnrollment.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          subject: {
            include: {
              attendanceSessions: {
                where: { isCancelled: false },
                include: { records: { where: { userId: user.id } } },
              },
            },
          },
        },
      }),
    ])

    const attendanceSummary = enrollmentsWithAttendance.map(enrollment => {
      const sessions = enrollment.subject.attendanceSessions
      let present = 0
      sessions.forEach(s => {
        const rec = s.records[0]
        if (rec && (rec.status === 'PRESENT' || rec.status === 'LATE')) present++
      })
      return {
        subjectId: enrollment.subject.id,
        subjectCode: enrollment.subject.code,
        subjectName: enrollment.subject.name,
        present,
        total: sessions.length,
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0,
      }
    })

    const deadlines = [
      ...upcomingAssignments.map(a => ({
        id: a.id,
        title: a.title,
        subtitle: `${a.subject.code} Assignment`,
        dueDate: a.dueDate,
        href: '/dashboard/assignments',
      })),
      ...upcomingTasks.map(t => ({
        id: t.id,
        title: t.title,
        subtitle: 'Personal Task',
        dueDate: t.dueDate!,
        href: '/dashboard/planner',
      })),
    ]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5)

    return NextResponse.json(
      serializeBigInt({
        role: user.role,
        stats: {
          documentsCount,
          studyMaterialsCount,
          activeProjectsCount,
          upcomingDeadlinesCount: upcomingAssignments.length + upcomingTasks.length,
        },
        upcomingDeadlines: deadlines,
        recentDocuments,
        attendanceSummary,
      })
    )
  } catch (error) {
    console.error('[Dashboard] Stats fetch error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
