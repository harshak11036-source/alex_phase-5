import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
} from '@/lib/classroom-permissions'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'summary'
    const subjectId = searchParams.get('subjectId')
    const studentId = searchParams.get('studentId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const threshold = parseInt(searchParams.get('threshold') || '75')

    if (!context.isTeacher) {
      if (reportType === 'student' && (!studentId || studentId === user.id)) {
        return getStudentAttendanceReport(user.id, subjectId, startDate, endDate)
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (subjectId && !context.isAdmin) {
      const access = await verifySubjectManagementAccess(user, subjectId)
      if (!access.allowed) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
    }

    const assignedSubjectIds = !context.isAdmin
      ? (
          await prisma.lecturerAssignment.findMany({
            where: { userId: user.id },
            select: { subjectId: true },
          })
        ).map((a) => a.subjectId)
      : undefined

    if (reportType === 'low_attendance') {
      return getLowAttendanceReport(
        context.institutionId,
        threshold,
        subjectId,
        startDate,
        endDate,
        assignedSubjectIds
      )
    } else if (reportType === 'subject') {
      return getSubjectAttendanceReport(subjectId, startDate, endDate, assignedSubjectIds)
    } else if (reportType === 'student') {
      return getStudentAttendanceReport(
        studentId || user.id,
        subjectId,
        startDate,
        endDate
      )
    } else if (reportType === 'summary') {
      return getAttendanceSummaryReport(
        context.institutionId,
        subjectId,
        startDate,
        endDate,
        assignedSubjectIds
      )
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance Reports] Error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

async function getLowAttendanceReport(
  institutionId: string | null,
  threshold: number,
  subjectId: string | null,
  startDate: string | null,
  endDate: string | null,
  allowedSubjectIds?: string[]
) {
  const sessionWhere: any = { isCancelled: false }
  if (subjectId) {
    sessionWhere.subjectId = subjectId
  } else if (allowedSubjectIds) {
    sessionWhere.subjectId = { in: allowedSubjectIds }
  }
  if (startDate || endDate) {
    sessionWhere.date = {}
    if (startDate) sessionWhere.date.gte = new Date(startDate)
    if (endDate) sessionWhere.date.lte = new Date(endDate)
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: sessionWhere,
    include: {
      subject: true,
      records: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })

  const studentStats = new Map<
    string,
    {
      user: any
      subjects: Map<
        string,
        {
          present: number
          absent: number
          late: number
          excused: number
          onDuty: number
          total: number
          subject: any
        }
      >
    }
  >()

  for (const session of sessions) {
    for (const record of session.records) {
      if (!studentStats.has(record.userId)) {
        studentStats.set(record.userId, {
          user: record.user,
          subjects: new Map(),
        })
      }
      const student = studentStats.get(record.userId)!
      if (!student.subjects.has(session.subjectId)) {
        student.subjects.set(session.subjectId, {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          onDuty: 0,
          total: 0,
          subject: session.subject,
        })
      }
      const subj = student.subjects.get(session.subjectId)!
      subj.total++
      if (record.status === 'PRESENT') subj.present++
      else if (record.status === 'ABSENT') subj.absent++
      else if (record.status === 'LATE') subj.late++
      else if (record.status === 'EXCUSED') subj.excused++
      else if (record.status === 'ON_DUTY') subj.onDuty++
    }
  }

  const lowAttendanceList: any[] = []

  studentStats.forEach((data, userId) => {
    data.subjects.forEach((subjData, subjId) => {
      const effectiveTotal = Math.max(0, subjData.total - subjData.excused)
      const attended = subjData.present + subjData.late + subjData.onDuty
      const percentage =
        effectiveTotal > 0 ? Math.round((attended / effectiveTotal) * 100) : 100

      if (percentage < threshold) {
        lowAttendanceList.push({
          userId,
          studentName: `${data.user.firstName} ${data.user.lastName}`,
          studentEmail: data.user.email,
          subjectId: subjId,
          subjectName: subjData.subject.name,
          subjectCode: subjData.subject.code,
          present: subjData.present,
          absent: subjData.absent,
          late: subjData.late,
          excused: subjData.excused,
          onDuty: subjData.onDuty,
          total: subjData.total,
          percentage,
        })
      }
    })
  })

  lowAttendanceList.sort((a, b) => a.percentage - b.percentage)

  return NextResponse.json({
    reportType: 'low_attendance',
    threshold,
    totalStudents: lowAttendanceList.length,
    students: lowAttendanceList,
    institutionId,
  })
}

async function getSubjectAttendanceReport(
  subjectId: string | null,
  startDate: string | null,
  endDate: string | null,
  allowedSubjectIds?: string[]
) {
  if (!subjectId) {
    return NextResponse.json({ error: 'Subject ID required' }, { status: 400 })
  }
  if (allowedSubjectIds && !allowedSubjectIds.includes(subjectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessionWhere: any = { subjectId, isCancelled: false }
  if (startDate || endDate) {
    sessionWhere.date = {}
    if (startDate) sessionWhere.date.gte = new Date(startDate)
    if (endDate) sessionWhere.date.lte = new Date(endDate)
  }

  const [subject, sessions] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        semester: true,
        department: true,
        enrollments: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                memberships: { select: { studentId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: {
        records: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
  }

  const sessionStats = sessions.map((session) => {
    const present = session.records.filter((r) => r.status === 'PRESENT').length
    const absent = session.records.filter((r) => r.status === 'ABSENT').length
    const late = session.records.filter((r) => r.status === 'LATE').length
    const excused = session.records.filter((r) => r.status === 'EXCUSED').length
    const onDuty = session.records.filter((r) => r.status === 'ON_DUTY').length
    const total = session.records.length
    const effectiveTotal = Math.max(0, total - excused)

    return {
      sessionId: session.id,
      date: session.date,
      period: session.period,
      topic: session.topic,
      present,
      absent,
      late,
      excused,
      onDuty,
      total,
      percentage:
        effectiveTotal > 0
          ? Math.round(((present + late + onDuty) / effectiveTotal) * 100)
          : 0,
    }
  })

  const studentBreakdown = subject.enrollments.map((enrollment) => {
    let present = 0
    let absent = 0
    let late = 0
    let excused = 0
    let onDuty = 0

    for (const session of sessions) {
      const rec = session.records.find((r) => r.userId === enrollment.userId)
      if (!rec) continue
      if (rec.status === 'PRESENT') present++
      else if (rec.status === 'ABSENT') absent++
      else if (rec.status === 'LATE') late++
      else if (rec.status === 'EXCUSED') excused++
      else if (rec.status === 'ON_DUTY') onDuty++
    }

    const effectiveTotal = Math.max(0, sessions.length - excused)
    const attended = present + late + onDuty
    const percentage =
      effectiveTotal > 0 ? Math.round((attended / effectiveTotal) * 100) : 0

    return {
      userId: enrollment.user.id,
      studentName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
      studentEmail: enrollment.user.email,
      studentId: enrollment.user.memberships?.[0]?.studentId || null,
      present,
      absent,
      late,
      excused,
      onDuty,
      totalSessions: sessions.length,
      percentage,
    }
  })

  return NextResponse.json({
    reportType: 'subject',
    subject: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      semester: subject.semester.name,
      department: subject.department.name,
    },
    totalSessions: sessions.length,
    sessions: sessionStats,
    students: studentBreakdown,
  })
}

async function getStudentAttendanceReport(
  studentId: string,
  subjectId: string | null,
  startDate: string | null,
  endDate: string | null
) {
  const enrollmentWhere: any = { userId: studentId, isActive: true }
  if (subjectId) enrollmentWhere.subjectId = subjectId

  const enrollments = await prisma.subjectEnrollment.findMany({
    where: enrollmentWhere,
    include: {
      subject: {
        include: {
          attendanceSessions: {
            where: {
              isCancelled: false,
              ...(startDate || endDate
                ? {
                    date: {
                      ...(startDate ? { gte: new Date(startDate) } : {}),
                      ...(endDate ? { lte: new Date(endDate) } : {}),
                    },
                  }
                : {}),
            },
            include: {
              records: { where: { userId: studentId } },
            },
            orderBy: { date: 'desc' },
          },
        },
      },
    },
  })

  const subjectReports = enrollments.map((enrollment) => {
    const sessions = enrollment.subject.attendanceSessions
    let present = 0
    let absent = 0
    let late = 0
    let excused = 0
    let onDuty = 0

    const sessionDetails = sessions.map((session) => {
      const record = session.records[0]
      const status = record?.status || 'NOT_MARKED'
      if (status === 'PRESENT') present++
      else if (status === 'ABSENT') absent++
      else if (status === 'LATE') late++
      else if (status === 'EXCUSED') excused++
      else if (status === 'ON_DUTY') onDuty++

      return {
        sessionId: session.id,
        date: session.date,
        period: session.period,
        topic: session.topic,
        status,
        remarks: record?.remarks,
      }
    })

    const total = sessions.length
    const effectiveTotal = Math.max(0, total - excused)
    const percentage =
      effectiveTotal > 0
        ? Math.round(((present + late + onDuty) / effectiveTotal) * 100)
        : 100

    return {
      subjectId: enrollment.subject.id,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      present,
      absent,
      late,
      excused,
      onDuty,
      total,
      percentage,
      sessions: sessionDetails,
    }
  })

  return NextResponse.json({
    reportType: 'student',
    studentId,
    subjects: subjectReports,
  })
}

async function getAttendanceSummaryReport(
  institutionId: string | null,
  subjectId: string | null,
  startDate: string | null,
  endDate: string | null,
  allowedSubjectIds?: string[]
) {
  const subjectWhere: any = {}
  if (institutionId) subjectWhere.institutionId = institutionId
  if (subjectId) {
    subjectWhere.id = subjectId
  } else if (allowedSubjectIds) {
    subjectWhere.id = { in: allowedSubjectIds }
  }

  const subjects = await prisma.subject.findMany({
    where: subjectWhere,
    include: {
      semester: true,
      department: true,
      attendanceSessions: {
        where: {
          isCancelled: false,
          ...(startDate || endDate
            ? {
                date: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              }
            : {}),
        },
        include: { records: true },
      },
      _count: { select: { enrollments: true } },
    },
  })

  const summary = subjects.map((subject) => {
    const totalSessions = subject.attendanceSessions.length
    let totalPresent = 0
    let totalAbsent = 0
    let totalLate = 0
    let totalExcused = 0
    let totalOnDuty = 0
    let totalRecords = 0

    subject.attendanceSessions.forEach((session) => {
      session.records.forEach((record) => {
        totalRecords++
        if (record.status === 'PRESENT') totalPresent++
        else if (record.status === 'ABSENT') totalAbsent++
        else if (record.status === 'LATE') totalLate++
        else if (record.status === 'EXCUSED') totalExcused++
        else if (record.status === 'ON_DUTY') totalOnDuty++
      })
    })

    const effectiveTotal = Math.max(0, totalRecords - totalExcused)
    const avgPercentage =
      effectiveTotal > 0
        ? Math.round(
            ((totalPresent + totalLate + totalOnDuty) / effectiveTotal) * 100
          )
        : 0

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
      semester: subject.semester.name,
      department: subject.department.name,
      enrolledStudents: subject._count.enrollments,
      totalSessions,
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate,
      excused: totalExcused,
      onDuty: totalOnDuty,
      avgAttendancePercentage: avgPercentage,
    }
  })

  return NextResponse.json({
    reportType: 'summary',
    subjects: summary,
  })
}
