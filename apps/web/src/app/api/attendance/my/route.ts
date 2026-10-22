import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { resolveClassroomContext } from '@/lib/classroom-permissions'

export async function GET(request?: Request) {
  await headers()

  try {
    const user = await requireAuth()
    const context = await resolveClassroomContext(user)
    const filterSubjectId = request?.url
      ? new URL(request.url).searchParams.get('subjectId')
      : null

    const enrollments = await prisma.subjectEnrollment.findMany({
      where: {
        userId: user.id,
        isActive: true,
        ...(filterSubjectId ? { subjectId: filterSubjectId } : {}),
      },
      include: {
        subject: {
          include: {
            attendanceSessions: {
              include: {
                records: {
                  where: { userId: user.id },
                },
              },
              where: { isCancelled: false },
            },
          },
        },
      },
    })

    let totalSessions = 0
    let presentCount = 0
    let absentCount = 0
    let lateCount = 0
    let excusedCount = 0
    let onDutyCount = 0

    enrollments.forEach((enrollment) => {
      const sessions = enrollment.subject?.attendanceSessions || []
      totalSessions += sessions.length

      sessions.forEach((session) => {
        const record = (session.records || [])[0]
        if (!record) return
        if (record.status === 'PRESENT') presentCount++
        else if (record.status === 'LATE') lateCount++
        else if (record.status === 'EXCUSED') excusedCount++
        else if (record.status === 'ON_DUTY') onDutyCount++
        else if (record.status === 'ABSENT') absentCount++
      })
    })

    const attendedCount = presentCount + lateCount + onDutyCount
    const effectiveTotal = Math.max(0, totalSessions - excusedCount)
    const overallPercentage =
      effectiveTotal > 0 ? Math.round((attendedCount / effectiveTotal) * 100) : 0

    const stats = {
      overallPercentage,
      present: presentCount,
      absent: absentCount,
      late: lateCount,
      excused: excusedCount,
      onDuty: onDutyCount,
      total: totalSessions,
      bySubject: enrollments.map((enrollment) => {
        const sessions = enrollment.subject?.attendanceSessions || []
        let present = 0
        let absent = 0
        let late = 0
        let excused = 0
        let onDuty = 0

        sessions.forEach((session) => {
          const record = (session.records || [])[0]
          if (!record) return
          if (record.status === 'PRESENT') present++
          else if (record.status === 'LATE') late++
          else if (record.status === 'EXCUSED') excused++
          else if (record.status === 'ON_DUTY') onDuty++
          else if (record.status === 'ABSENT') absent++
        })

        const subjectEffectiveTotal = Math.max(0, sessions.length - excused)
        const subjectAttended = present + late + onDuty
        return {
          subjectId: enrollment.subject.id,
          subjectCode: enrollment.subject.code,
          subjectName: enrollment.subject.name,
          percentage:
            subjectEffectiveTotal > 0
              ? Math.round((subjectAttended / subjectEffectiveTotal) * 100)
              : 0,
          present,
          absent,
          late,
          excused,
          onDuty,
          total: sessions.length,
        }
      }),
    }

    const subjects = enrollments.map((enrollment) => {
      const sessions = enrollment.subject?.attendanceSessions || []
      let present = 0
      let absent = 0
      let late = 0
      let excused = 0
      let onDuty = 0

      sessions.forEach((session) => {
        const record = (session.records || [])[0]
        if (!record) return
        if (record.status === 'PRESENT') present++
        else if (record.status === 'LATE') late++
        else if (record.status === 'EXCUSED') excused++
        else if (record.status === 'ON_DUTY') onDuty++
        else if (record.status === 'ABSENT') absent++
      })

      const subjectEffectiveTotal = Math.max(0, sessions.length - excused)
      const subjectAttended = present + late + onDuty

      return {
        subject: {
          id: enrollment.subject.id,
          name: enrollment.subject.name,
          code: enrollment.subject.code,
        },
        totalSessions: sessions.length,
        presentCount: present,
        absentCount: absent,
        lateCount: late,
        excusedCount: excused,
        onDutyCount: onDuty,
        attendancePercentage:
          subjectEffectiveTotal > 0
            ? Math.round((subjectAttended / subjectEffectiveTotal) * 100)
            : 0,
      }
    })

    let teachingSubjects: any[] = []
    if (context.isTeacher) {
      const taughtSubjects = await prisma.subject.findMany({
        where: {
          ...(filterSubjectId ? { id: filterSubjectId } : {}),
          ...(context.isAdmin
            ? {}
            : { lecturers: { some: { userId: user.id } } }),
        },
        include: {
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
          attendanceSessions: {
            where: { isCancelled: false },
            include: { records: true },
            orderBy: { date: 'desc' },
          },
        },
      })

      teachingSubjects = taughtSubjects.map((subj) => {
        const activeSessions = subj.attendanceSessions || []
        const subjEnrollments = subj.enrollments || []
        let totalMarked = 0
        let totalPresent = 0
        let totalAbsent = 0
        let totalLate = 0
        let totalExcused = 0
        let totalOnDuty = 0

        for (const sess of activeSessions) {
          for (const rec of sess.records || []) {
            totalMarked++
            if (rec.status === 'PRESENT') totalPresent++
            else if (rec.status === 'ABSENT') totalAbsent++
            else if (rec.status === 'LATE') totalLate++
            else if (rec.status === 'EXCUSED') totalExcused++
            else if (rec.status === 'ON_DUTY') totalOnDuty++
          }
        }

        const effectiveMarked = Math.max(0, totalMarked - totalExcused)
        const classPercentage =
          effectiveMarked > 0
            ? Math.round(
                ((totalPresent + totalLate + totalOnDuty) / effectiveMarked) * 100
              )
            : 0

        const studentSummaries = subjEnrollments.map((enr) => {
          let sPresent = 0
          let sAbsent = 0
          let sLate = 0
          let sExcused = 0
          let sOnDuty = 0

          for (const sess of activeSessions) {
            const rec = (sess.records || []).find((r) => r.userId === enr.userId)
            if (!rec) continue
            if (rec.status === 'PRESENT') sPresent++
            else if (rec.status === 'ABSENT') sAbsent++
            else if (rec.status === 'LATE') sLate++
            else if (rec.status === 'EXCUSED') sExcused++
            else if (rec.status === 'ON_DUTY') sOnDuty++
          }

          const sEffectiveTotal = Math.max(0, activeSessions.length - sExcused)
          const sAttended = sPresent + sLate + sOnDuty
          const sPercentage =
            sEffectiveTotal > 0 ? Math.round((sAttended / sEffectiveTotal) * 100) : 0

          return {
            userId: enr.user?.id || enr.userId,
            firstName: enr.user?.firstName || '',
            lastName: enr.user?.lastName || '',
            email: enr.user?.email || '',
            studentId: enr.user?.memberships?.[0]?.studentId || null,
            present: sPresent,
            absent: sAbsent,
            late: sLate,
            excused: sExcused,
            onDuty: sOnDuty,
            totalSessions: activeSessions.length,
            percentage: sPercentage,
          }
        })

        return {
          subject: {
            id: subj.id,
            name: subj.name,
            code: subj.code,
          },
          enrolledCount: subjEnrollments.length,
          totalSessions: activeSessions.length,
          presentCount: totalPresent,
          absentCount: totalAbsent,
          lateCount: totalLate,
          excusedCount: totalExcused,
          onDutyCount: totalOnDuty,
          attendancePercentage: classPercentage,
          students: studentSummaries,
        }
      })

      if (enrollments.length === 0 && teachingSubjects.length > 0) {
        const aggPresent = teachingSubjects.reduce((s, t) => s + t.presentCount, 0)
        const aggAbsent = teachingSubjects.reduce((s, t) => s + t.absentCount, 0)
        const aggLate = teachingSubjects.reduce((s, t) => s + t.lateCount, 0)
        const aggExcused = teachingSubjects.reduce((s, t) => s + t.excusedCount, 0)
        const aggOnDuty = teachingSubjects.reduce((s, t) => s + t.onDutyCount, 0)
        const aggSessions = teachingSubjects.reduce((s, t) => s + t.totalSessions, 0)
        const aggMarked = aggPresent + aggAbsent + aggLate + aggExcused + aggOnDuty
        const aggEffective = Math.max(0, aggMarked - aggExcused)

        stats.overallPercentage =
          aggEffective > 0
            ? Math.round(((aggPresent + aggLate + aggOnDuty) / aggEffective) * 100)
            : 0
        stats.present = aggPresent
        stats.absent = aggAbsent
        stats.late = aggLate
        stats.excused = aggExcused
        stats.onDuty = aggOnDuty
        stats.total = aggSessions
        stats.bySubject = teachingSubjects.map((t) => ({
          subjectId: t.subject.id,
          subjectCode: t.subject.code,
          subjectName: t.subject.name,
          percentage: t.attendancePercentage,
          present: t.presentCount,
          absent: t.absentCount,
          late: t.lateCount,
          excused: t.excusedCount,
          onDuty: t.onDutyCount,
          total: t.totalSessions,
        }))
      }
    }

    return NextResponse.json({
      stats,
      subjects: subjects.length > 0 ? subjects : teachingSubjects,
      teachingSubjects,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Attendance] My attendance error:', error)
    return NextResponse.json({ error: 'Failed to get attendance' }, { status: 500 })
  }
}
