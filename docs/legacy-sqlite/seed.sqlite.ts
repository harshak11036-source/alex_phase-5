import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting SQLite database seed...')

  // Clean up existing data (in reverse order of dependencies)
  // Using deleteMany for SQLite compatibility
  const tablesToClean = [
    'generatedImage', 'quizAttempt', 'quiz', 'diagram', 'mindMap',
    'flashcardReview', 'flashcard', 'flashcardDeck', 'studyMaterial',
    'subjectResource', 'auditLog', 'guardianContact', 'notificationDelivery',
    'notification', 'notificationPreference', 'notificationConfig',
    'plannerEvent', 'task', 'userMemory', 'message', 'conversation',
    'researchNote', 'researchSource', 'researchNotebook', 'projectDiscussion',
    'projectMilestone', 'projectTask', 'projectMentor', 'projectMember',
    'project', 'submissionAttachment', 'assignmentSubmission', 'assignmentAttachment',
    'assignment', 'assessmentResult', 'assessment', 'attendanceRecord',
    'attendanceSession', 'projectDiscussion', 'projectMilestone', 'projectTask',
    'projectMentor', 'projectMember', 'project', 'researchNote', 'researchSource',
    'researchNotebook', 'studyMaterial', 'subjectResource', 'flashcardDeck',
    'flashcard', 'mindMap', 'diagram', 'quiz', 'quizAttempt', 'generatedImage',
    'studyPlans', 'documentChunk', 'documentProcessingJob', 'documentVersion',
    'document', 'subjectEnrollment', 'lecturerAssignment', 'subject',
    'semester', 'course', 'academicYear', 'department', 'collegeMembership',
    'user', 'institution'
  ]

  // Delete in reverse dependency order
  const reverseTables = [...tablesToClean].reverse()
  
  for (const table of reverseTables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`)
    } catch (e) {
      // Table might not exist in SQLite, continue
    }
  }

  console.log('🧹 Cleaned existing data')

  // Create institution
  const institution = await prisma.institution.create({
    data: {
      name: 'Tech University',
      code: 'TU',
      domain: 'techuniversity.edu',
      address: '123 Tech Street, Innovation City',
      phone: '+1-555-0100',
      email: 'info@techuniversity.edu',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('🏫 Created institution:', institution.name)

  // Create departments
  const csDept = await prisma.department.create({
    data: {
      name: 'Computer Science',
      code: 'CS',
      institutionId: institution.id,
      description: 'Department of Computer Science and Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const eeDept = await prisma.department.create({
    data: {
      name: 'Electrical Engineering',
      code: 'EE',
      institutionId: institution.id,
      description: 'Department of Electrical and Computer Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const mathDept = await prisma.department.create({
    data: {
      name: 'Mathematics',
      code: 'MATH',
      institutionId: institution.id,
      description: 'Department of Mathematics and Statistics',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('🏢 Created departments')

  // Create courses
  const csCourse = await prisma.course.create({
    data: {
      name: 'Bachelor of Computer Science',
      code: 'BCS',
      institutionId: institution.id,
      departmentId: csDept.id,
      durationYears: 4,
      description: 'Four-year undergraduate program in Computer Science',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const eeCourse = await prisma.course.create({
    data: {
      name: 'Bachelor of Electrical Engineering',
      code: 'BEE',
      institutionId: institution.id,
      departmentId: eeDept.id,
      durationYears: 4,
      description: 'Four-year undergraduate program in Electrical Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📚 Created courses')

  // Create academic year
  const academicYear = await prisma.academicYear.create({
    data: {
      name: '2024-2025',
      institutionId: institution.id,
      startDate: new Date('2024-08-01'),
      endDate: new Date('2025-05-31'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📅 Created academic year')

  // Create semesters
  const fallSemester = await prisma.semester.create({
    data: {
      name: 'Fall 2024',
      number: 1,
      institutionId: institution.id,
      academicYearId: academicYear.id,
      courseId: csCourse.id,
      startDate: new Date('2024-08-26'),
      endDate: new Date('2024-12-15'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const springSemester = await prisma.semester.create({
    data: {
      name: 'Spring 2025',
      number: 2,
      institutionId: institution.id,
      academicYearId: academicYear.id,
      courseId: csCourse.id,
      startDate: new Date('2025-01-13'),
      endDate: new Date('2025-05-02'),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📖 Created semesters')

  // Create subjects
  const subjects = await Promise.all([
    prisma.subject.create({
      data: {
        name: 'Data Structures and Algorithms',
        code: 'CS201',
        institutionId: institution.id,
        departmentId: csDept.id,
        semesterId: fallSemester.id,
        credits: 4,
        description: 'Fundamental data structures and algorithmic techniques',
        syllabus: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, Sorting, Searching, Dynamic Programming',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Computer Networks',
        code: 'CS301',
        institutionId: institution.id,
        departmentId: csDept.id,
        semesterId: fallSemester.id,
        credits: 3,
        description: 'Fundamentals of computer networking and protocols',
        syllabus: 'OSI Model, TCP/IP, Routing, Switching, Network Security, Wireless Networks',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Database Systems',
        code: 'CS302',
        institutionId: institution.id,
        departmentId: csDept.id,
        semesterId: fallSemester.id,
        credits: 3,
        description: 'Relational database design and SQL',
        syllabus: 'ER Modeling, Relational Model, SQL, Normalization, Transactions, Indexing',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Operating Systems',
        code: 'CS303',
        institutionId: institution.id,
        departmentId: csDept.id,
        semesterId: springSemester.id,
        credits: 4,
        description: 'Operating system concepts and implementation',
        syllabus: 'Processes, Threads, Scheduling, Memory Management, File Systems, Security',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Calculus I',
        code: 'MATH101',
        institutionId: institution.id,
        departmentId: mathDept.id,
        semesterId: fallSemester.id,
        credits: 4,
        description: 'Differential and integral calculus of functions of one variable',
        syllabus: 'Limits, Continuity, Derivatives, Applications of Derivatives, Integrals, Fundamental Theorem of Calculus',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.subject.create({
      data: {
        name: 'Linear Algebra',
        code: 'MATH201',
        institutionId: institution.id,
        departmentId: mathDept.id,
        semesterId: springSemester.id,
        credits: 3,
        description: 'Vector spaces, linear transformations, and matrices',
        syllabus: 'Systems of Linear Equations, Vector Spaces, Eigenvalues, Eigenvectors, Orthogonality',
        textbooks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('📝 Created subjects')

  // Create users with different roles
  const passwordHash = await hash('password123', 12)

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@techuniversity.edu',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const lecturer1 = await prisma.user.create({
    data: {
      email: 'prof.smith@techuniversity.edu',
      passwordHash,
      firstName: 'John',
      lastName: 'Smith',
      role: 'LECTURER',
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const lecturer2 = await prisma.user.create({
    data: {
      email: 'prof.jones@techuniversity.edu',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Jones',
      role: 'LECTURER',
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  const mentor1 = await prisma.user.create({
    data: {
      email: 'mentor.wilson@techuniversity.edu',
      passwordHash,
      firstName: 'Robert',
      lastName: 'Wilson',
      role: 'PROJECT_MENTOR',
      isActive: true,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  // Create student users
  const students = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice.student@techuniversity.edu',
        passwordHash,
        firstName: 'Alice',
        lastName: 'Anderson',
        role: 'STUDENT',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob.student@techuniversity.edu',
        passwordHash,
        firstName: 'Bob',
        lastName: 'Brown',
        role: 'STUDENT',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: 'carol.student@techuniversity.edu',
        passwordHash,
        firstName: 'Carol',
        lastName: 'Chen',
        role: 'STUDENT',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: 'david.student@techuniversity.edu',
        passwordHash,
        firstName: 'David',
        lastName: 'Davis',
        role: 'STUDENT',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.user.create({
      data: {
        email: 'eve.student@techuniversity.edu',
        passwordHash,
        firstName: 'Eve',
        lastName: 'Evans',
        role: 'STUDENT',
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('👥 Created users')

  // Create college memberships
  await Promise.all([
    prisma.collegeMembership.create({
      data: {
        userId: adminUser.id,
        institutionId: institution.id,
        role: 'ADMIN',
        status: 'ACTIVE',
        employeeId: 'EMP001',
        enrolledAt: new Date('2020-01-15'),
        verifiedAt: new Date('2020-01-15'),
        verifiedBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.collegeMembership.create({
      data: {
        userId: lecturer1.id,
        institutionId: institution.id,
        departmentId: csDept.id,
        role: 'LECTURER',
        status: 'ACTIVE',
        employeeId: 'EMP002',
        enrolledAt: new Date('2018-08-01'),
        verifiedAt: new Date('2018-08-01'),
        verifiedBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.collegeMembership.create({
      data: {
        userId: lecturer2.id,
        institutionId: institution.id,
        departmentId: csDept.id,
        role: 'LECTURER',
        status: 'ACTIVE',
        employeeId: 'EMP003',
        enrolledAt: new Date('2019-01-15'),
        verifiedAt: new Date('2019-01-15'),
        verifiedBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.collegeMembership.create({
      data: {
        userId: mentor1.id,
        institutionId: institution.id,
        departmentId: csDept.id,
        role: 'PROJECT_MENTOR',
        status: 'ACTIVE',
        employeeId: 'EMP004',
        enrolledAt: new Date('2020-06-01'),
        verifiedAt: new Date('2020-06-01'),
        verifiedBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])

  // Student memberships
  for (let i = 0; i < students.length; i++) {
    await prisma.collegeMembership.create({
      data: {
        userId: students[i].id,
        institutionId: institution.id,
        departmentId: csDept.id,
        courseId: csCourse.id,
        semesterId: fallSemester.id,
        academicYearId: academicYear.id,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: `STU${String(2024000 + i + 1).padStart(4, '0')}`,
        enrolledAt: new Date('2024-08-20'),
        verifiedAt: new Date('2024-08-20'),
        verifiedBy: adminUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }
  console.log('🎓 Created college memberships')

  // Create lecturer assignments
  await Promise.all([
    prisma.lecturerAssignment.create({
      data: {
        userId: lecturer1.id,
        subjectId: subjects[0].id, // CS201
        assignedAt: new Date('2024-08-01'),
        assignedBy: adminUser.id,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.lecturerAssignment.create({
      data: {
        userId: lecturer1.id,
        subjectId: subjects[2].id, // CS302
        assignedAt: new Date('2024-08-01'),
        assignedBy: adminUser.id,
        isPrimary: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.lecturerAssignment.create({
      data: {
        userId: lecturer2.id,
        subjectId: subjects[1].id, // CS301
        assignedAt: new Date('2024-08-01'),
        assignedBy: adminUser.id,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('👨‍🏫 Created lecturer assignments')

  // Create subject enrollments
  for (const student of students) {
    for (const subject of subjects.slice(0, 3)) { // Enroll in fall semester subjects
      await prisma.subjectEnrollment.create({
        data: {
          userId: student.id,
          subjectId: subject.id,
          semesterId: fallSemester.id,
          enrolledAt: new Date('2024-08-25'),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }
  }
  console.log('📋 Created subject enrollments')

  // Create attendance sessions (past dates)
  const sessions = await Promise.all([
    prisma.attendanceSession.create({
      data: {
        subjectId: subjects[0].id,
        semesterId: fallSemester.id,
        date: new Date('2024-09-02'),
        period: 1,
        topic: 'Introduction to Arrays and Linked Lists',
        conductedBy: lecturer1.id,
        isCancelled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.attendanceSession.create({
      data: {
        subjectId: subjects[0].id,
        semesterId: fallSemester.id,
        date: new Date('2024-09-04'),
        period: 1,
        topic: 'Stacks and Queues Implementation',
        conductedBy: lecturer1.id,
        isCancelled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.attendanceSession.create({
      data: {
        subjectId: subjects[1].id,
        semesterId: fallSemester.id,
        date: new Date('2024-09-03'),
        period: 2,
        topic: 'OSI Model and TCP/IP Stack',
        conductedBy: lecturer2.id,
        isCancelled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.attendanceSession.create({
      data: {
        subjectId: subjects[1].id,
        semesterId: fallSemester.id,
        date: new Date('2024-09-05'),
        period: 2,
        topic: 'Routing Protocols: RIP, OSPF, BGP',
        conductedBy: lecturer2.id,
        isCancelled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.attendanceSession.create({
      data: {
        subjectId: subjects[2].id,
        semesterId: fallSemester.id,
        date: new Date('2024-09-06'),
        period: 3,
        topic: 'ER Modeling and Relational Model',
        conductedBy: lecturer1.id,
        isCancelled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('📅 Created attendance sessions')

  // Create attendance records
  const statuses: Array<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT']
  for (const session of sessions) {
    for (let i = 0; i < students.length; i++) {
      const status = statuses[(i + sessions.indexOf(session)) % statuses.length]
      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          userId: students[i].id,
          status,
          markedBy: lecturer1.id,
          markedAt: new Date(session.date.getTime() + 2 * 60 * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }
  }
  console.log('✅ Created attendance records')

  // Create assessments
  const assessments = await Promise.all([
    prisma.assessment.create({
      data: {
        subjectId: subjects[0].id,
        semesterId: fallSemester.id,
        name: 'Midterm Exam - Data Structures',
        type: 'INTERNAL_ASSESSMENT',
        maxMarks: 100,
        weight: 1.0,
        assessmentDate: new Date('2024-10-15'),
        description: 'Covers Arrays, Linked Lists, Stacks, Queues, and Trees',
        isPublished: true,
        publishedAt: new Date('2024-10-20'),
        createdBy: lecturer1.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.assessment.create({
      data: {
        subjectId: subjects[0].id,
        semesterId: fallSemester.id,
        name: 'Programming Assignment 1 - Stack Calculator',
        type: 'ASSIGNMENT',
        maxMarks: 50,
        weight: 0.5,
        assessmentDate: new Date('2024-09-20'),
        description: 'Implement a calculator using stack data structure',
        isPublished: true,
        publishedAt: new Date('2024-09-25'),
        createdBy: lecturer1.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.assessment.create({
      data: {
        subjectId: subjects[1].id,
        semesterId: fallSemester.id,
        name: 'Network Simulation Lab',
        type: 'LAB_ASSESSMENT',
        maxMarks: 100,
        weight: 1.0,
        assessmentDate: new Date('2024-11-01'),
        description: 'Configure and simulate routing protocols in network simulator',
        isPublished: false,
        createdBy: lecturer2.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('📝 Created assessments')

  // Create assessment results
  const marks = [85, 92, 78, 65, 88]
  for (let i = 0; i < students.length; i++) {
    await prisma.assessmentResult.create({
      data: {
        assessmentId: assessments[0].id,
        userId: students[i].id,
        marksObtained: marks[i],
        feedback: marks[i] >= 80 ? 'Excellent work!' : marks[i] >= 70 ? 'Good effort' : 'Needs improvement',
        gradedBy: lecturer1.id,
        gradedAt: new Date('2024-10-18'),
        isPublished: true,
        publishedAt: new Date('2024-10-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    await prisma.assessmentResult.create({
      data: {
        assessmentId: assessments[1].id,
        userId: students[i].id,
        marksObtained: marks[i] * 0.5,
        feedback: 'Good implementation',
        gradedBy: lecturer1.id,
        gradedAt: new Date('2024-09-28'),
        isPublished: true,
        publishedAt: new Date('2024-09-25'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }
  console.log('📊 Created assessment results')

  // Create assignments
  await prisma.assignment.create({
    data: {
      subjectId: subjects[0].id,
      title: 'Binary Search Tree Implementation',
      description: 'Implement a BST with insert, delete, search, and traversal operations',
      instructions: 'Submit a single file with your implementation. Include test cases.',
      maxMarks: 100,
      weight: 1.0,
      assignedDate: new Date('2024-09-10'),
      dueDate: new Date('2024-09-30'),
      allowedFormats: ['zip', 'pdf', 'txt'],
      allowResubmission: true,
      maxSubmissions: 2,
      isPublished: true,
      createdBy: lecturer1.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.assignment.create({
    data: {
      subjectId: subjects[1].id,
      title: 'Network Topology Design',
      description: 'Design a network topology for a small company with 3 branches',
      instructions: 'Use Cisco Packet Tracer. Submit .pkt file and a report.',
      maxMarks: 100,
      weight: 1.0,
      assignedDate: new Date('2024-09-15'),
      dueDate: new Date('2024-10-15'),
      allowedFormats: ['pkt', 'pdf'],
      allowResubmission: false,
      maxSubmissions: 1,
      isPublished: true,
      createdBy: lecturer2.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📋 Created assignments')

  // Create assignment submissions
  for (const student of students.slice(0, 3)) {
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: (await prisma.assignment.findFirst({ where: { subjectId: subjects[0].id } }))!.id,
        userId: student.id,
        status: 'SUBMITTED',
        submissionNumber: 1,
        content: 'Implemented BST with all required operations. All test cases pass.',
        submittedAt: new Date('2024-09-28'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }
  console.log('📤 Created assignment submissions')

  // Create guardian contacts
  await Promise.all([
    prisma.guardianContact.create({
      data: {
        institutionId: institution.id,
        studentId: students[0].id,
        name: 'Robert Anderson',
        relationship: 'Father',
        email: 'robert.anderson@email.com',
        phone: '+1-555-0201',
        whatsapp: '+1-555-0201',
        isPrimary: true,
        consentGiven: true,
        consentAt: new Date('2024-08-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.guardianContact.create({
      data: {
        institutionId: institution.id,
        studentId: students[1].id,
        name: 'Mary Brown',
        relationship: 'Mother',
        email: 'mary.brown@email.com',
        phone: '+1-555-0202',
        whatsapp: '+1-555-0202',
        isPrimary: true,
        consentGiven: true,
        consentAt: new Date('2024-08-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    prisma.guardianContact.create({
      data: {
        institutionId: institution.id,
        studentId: students[2].id,
        name: 'James Chen',
        relationship: 'Father',
        email: 'james.chen@email.com',
        phone: '+1-555-0203',
        whatsapp: '+1-555-0203',
        isPrimary: true,
        consentGiven: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  ])
  console.log('👨‍👩‍👧‍👦 Created guardian contacts')

  // Create notification configs
  await prisma.notificationConfig.create({
    data: {
      institutionId: institution.id,
      provider: 'email',
      providerConfig: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'notifications@techuniversity.edu',
        password: 'placeholder',
      },
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📧 Created notification configs')

  // Create notification preferences for students
  for (const student of students) {
    await prisma.notificationPreference.createMany({
      data: [
        { userId: student.id, category: 'ASSIGNMENT', inAppEnabled: true, emailEnabled: true, pushEnabled: false, createdAt: new Date(), updatedAt: new Date() },
        { userId: student.id, category: 'ATTENDANCE', inAppEnabled: true, emailEnabled: true, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
        { userId: student.id, category: 'INTERNAL_ASSESSMENT', inAppEnabled: true, emailEnabled: true, pushEnabled: false, createdAt: new Date(), updatedAt: new Date() },
        { userId: student.id, category: 'ACADEMIC_ANNOUNCEMENT', inAppEnabled: true, emailEnabled: true, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
        { userId: student.id, category: 'UPCOMING_DEADLINE', inAppEnabled: true, emailEnabled: true, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
        { userId: student.id, category: 'STUDY_REMINDER', inAppEnabled: true, emailEnabled: false, pushEnabled: true, createdAt: new Date(), updatedAt: new Date() },
      ],
    })
  }
  console.log('🔔 Created notification preferences')

  // Create sample conversations and messages
  const conversation = await prisma.conversation.create({
    data: {
      userId: students[0].id,
      title: 'Help with Binary Search Tree',
      messages: {
        create: [
          {
            role: 'user',
            content: 'Can you explain how to implement a binary search tree insertion?',
            senderId: students[0].id,
            createdAt: new Date(),
          },
          {
            role: 'assistant',
            content: 'A binary search tree (BST) insertion works by comparing the value to insert with the current node...',
            senderId: students[0].id,
            metadata: { citations: [], sources: [] },
            createdAt: new Date(),
          },
],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  console.log('💬 Created sample conversation')

  // Create user memories
  await prisma.userMemory.createMany({
    data: [
      {
        userId: students[0].id,
        category: 'EXPLICIT_MEMORIES',
        key: 'preferred_language',
        value: 'Python',
        confidence: 1.0,
        source: 'User preference stated in conversation',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: students[0].id,
        category: 'EXPLICIT_MEMORIES',
        key: 'learning_style',
        value: 'Visual learner - prefers diagrams and code examples',
        confidence: 0.9,
        source: 'User mentioned in conversation',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: students[1].id,
        category: 'EXPLICIT_MEMORIES',
        key: 'preferred_language',
        value: 'JavaScript',
        confidence: 1.0,
        source: 'User preference stated in conversation',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })
  console.log('🧠 Created user memories')

  // Create planner events
  for (const student of students.slice(0, 2)) {
    await prisma.plannerEvent.createMany({
      data: [
        {
          userId: student.id,
          title: 'Study Group - Data Structures',
          description: 'Weekly study session for CS201',
          startTime: new Date('2024-09-10T18:00:00'),
          endTime: new Date('2024-09-10T19:30:00'),
          eventType: 'STUDY_SESSION',
          subjectId: subjects[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: student.id,
          title: 'CS201 Midterm Exam',
          description: 'Midterm exam covering weeks 1-6',
          startTime: new Date('2024-10-15T09:00:00'),
          endTime: new Date('2024-10-15T11:00:00'),
          eventType: 'EXAM',
          subjectId: subjects[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })
  }
  console.log('📅 Created planner events')

  // Create sample projects
  const project = await prisma.project.create({
    data: {
      title: 'Smart Campus Navigation App',
      description: 'Mobile app for indoor navigation across campus buildings',
      category: 'Mobile Development',
      tags: ['React Native', 'TypeScript', 'Firebase', 'Maps'],
      ownerId: students[0].id,
      status: 'ACTIVE',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-12-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: students[0].id, role: 'OWNER', joinedAt: new Date('2024-09-01'), createdAt: new Date(), updatedAt: new Date() },
      { projectId: project.id, userId: students[1].id, role: 'MEMBER', joinedAt: new Date('2024-09-05'), createdAt: new Date(), updatedAt: new Date() },
      { projectId: project.id, userId: students[2].id, role: 'MEMBER', joinedAt: new Date('2024-09-10'), createdAt: new Date(), updatedAt: new Date() },
    ],
  })

  await prisma.projectMentor.create({
    data: {
      projectId: project.id,
      userId: mentor1.id,
      assignedAt: new Date('2024-09-01'),
      assignedBy: adminUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('🚀 Created sample project')

  // Create research notebook
  const notebook = await prisma.researchNotebook.create({
    data: {
      title: 'Optimizing BST Operations for Large Datasets',
      description: 'Research on improving BST performance for millions of records',
      ownerId: students[0].id,
      projectId: project.id,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.researchNote.create({
    data: {
      notebookId: notebook.id,
      userId: students[0].id,
      title: 'Initial Literature Review',
      content: 'Reviewed papers on B-trees, Red-Black trees, and B+ trees...',
      sourceIds: [],
      tags: ['literature-review', 'bst', 'performance'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('🔬 Created research notebook')

  // Create sample flashcard deck
  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: students[0].id,
      title: 'CS201 - Data Structures Key Concepts',
      description: 'Flashcards for midterm exam preparation',
      subjectId: subjects[0].id,
      algorithm: 'SM2',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.flashcard.createMany({
    data: [
      { deckId: deck.id, front: 'What is the time complexity of binary search?', back: 'O(log n)', difficulty: 0, interval: 0, repetitions: 0, easeFactor: 2.5, nextReview: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { deckId: deck.id, front: 'What is a stack?', back: 'LIFO (Last In, First Out) data structure', difficulty: 0, interval: 0, repetitions: 0, easeFactor: 2.5, nextReview: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { deckId: deck.id, front: 'What is the difference between a stack and a queue?', back: 'Stack is LIFO, Queue is FIFO (First In, First Out)', difficulty: 0, interval: 0, repetitions: 0, easeFactor: 2.5, nextReview: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { deckId: deck.id, front: 'What is the height of a balanced BST with n nodes?', back: 'O(log n)', difficulty: 0, interval: 0, repetitions: 0, easeFactor: 2.5, nextReview: new Date(), createdAt: new Date(), updatedAt: new Date() },
      { deckId: deck.id, front: 'What is the worst-case time complexity of BST insertion?', back: 'O(n) - when tree becomes a linked list', difficulty: 0, interval: 0, repetitions: 0, easeFactor: 2.5, nextReview: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ],
  })
  console.log('🃏 Created flashcard deck')

  // Create sample study materials
  await prisma.studyMaterial.create({
    data: {
      userId: students[0].id,
      title: 'CS201 Midterm Summary',
      content: 'Key concepts for midterm:\n1. Arrays vs Linked Lists\n2. Stack vs Queue operations\n3. Tree traversals (inorder, preorder, postorder)\n4. BST properties and operations\n4. Hash tables and collision resolution\n5. Graph representations and basic algorithms',
      type: 'SUMMARY',
      subjectId: subjects[0].id,
      topic: 'Midterm Review',
      tags: ['midterm', 'review', 'data-structures'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('📄 Created study materials')

  // Create sample achievements
  await prisma.studentAchievement.createMany({
    data: [
      {
        userId: students[0].id,
        title: "Dean's List - Fall 2024",
        category: 'AWARD',
        organization: 'Tech University',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2024-12-15'),
        description: 'Achieved GPA 3.9+ for Fall 2024 semester',
        status: 'COMPLETED',
        verificationStatus: 'VERIFIED',
        verifiedBy: adminUser.id,
        verifiedAt: new Date('2025-01-10'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: students[1].id,
        title: 'ACM Programming Contest - 2nd Place',
        category: 'TECHNICAL_COMPETITION',
        organization: 'ACM ICPC',
        startDate: new Date('2024-11-15'),
        endDate: new Date('2024-11-15'),
        description: 'Team placed 2nd in regional programming contest',
        status: 'COMPLETED',
        verificationStatus: 'VERIFIED',
        verifiedBy: adminUser.id,
        verifiedAt: new Date('2024-11-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })
  console.log('🏆 Created achievements')

  // Create sample diagrams
  await prisma.diagram.createMany({
    data: [
      {
        userId: students[0].id,
        title: 'BST Insertion Flow',
        type: 'mermaid',
        sourceDocId: null,
        subjectId: subjects[0].id,
        definition: {
          type: 'mermaid',
          code: 'flowchart TD\n    A[Start] --> B{Value < Node?}\n    B -->|Yes| C[Go Left]\n    B -->|No| D[Go Right]\n    C --> E{Left Empty?}\n    D --> F{Right Empty?}\n    E -->|Yes| G[Insert Here]\n    E -->|No| C\n    F -->|Yes| G\n    F -->|No| D\n    G --> H[End]',
          title: 'BST Insertion Flowchart',
        },
        renderedUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: students[0].id,
        title: 'Network Topology',
        type: 'mermaid',
        sourceDocId: null,
        subjectId: subjects[1].id,
        definition: {
          type: 'mermaid',
          code: 'graph TD\n    A[Branch A] --> C[Headquarters]\n    B[Branch B] --> C\n    C --> D[Data Center]\n    A -.->|VPN| B',
          title: 'Company Network Topology',
        },
        renderedUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })
  console.log('📊 Created sample diagrams')

  // Create sample quizzes
  const quiz = await prisma.quiz.create({
    data: {
      userId: students[0].id,
      title: 'Data Structures Midterm Practice',
      description: 'Practice quiz for CS201 midterm',
      subjectId: subjects[0].id,
      topic: 'Trees and Graphs',
      difficulty: 'MEDIUM',
      questions: [
        { question: 'What is the maximum number of nodes at level k in a binary tree?', options: ['2^k', '2^(k-1)', 'k^2', '2k'], correct: 0 },
        { question: 'Which traversal visits nodes in ascending order in a BST?', options: ['Preorder', 'Inorder', 'Postorder', 'Level-order'], correct: 1 },
        { question: 'What is the time complexity of finding an element in a balanced BST?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 1 },
        { question: 'What is a heap property?', options: ['Parent > children (max-heap)', 'Parent < children (min-heap)', 'Both A and B depending on heap type', 'Neither'], correct: 2 },
      ],
      timeLimit: 30,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: students[0].id,
      answers: [0, 1, 1, 2],
      score: 75,
      maxScore: 100,
      startedAt: new Date('2024-10-10T10:00:00'),
      completedAt: new Date('2024-10-10T10:25:00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('❓ Created sample quiz')

  // Create sample diagrams
  await prisma.diagram.createMany({
    data: [
      {
        userId: students[0].id,
        title: 'BST Insertion Flow',
        type: 'mermaid',
        sourceDocId: null,
        subjectId: subjects[0].id,
        definition: {
          type: 'mermaid',
          code: 'flowchart TD\n    A[Start] --> B{Value < Node?}\n    B -->|Yes| C[Go Left]\n    B -->|No| D[Go Right]\n    C --> E{Left Empty?}\n    D --> F{Right Empty?}\n    E -->|Yes| G[Insert Here]\n    E -->|No| C\n    F -->|Yes| G\n    F -->|No| D\n    G --> H[End]',
          title: 'BST Insertion Flowchart',
        },
        renderedUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        userId: students[0].id,
        title: 'Network Topology',
        type: 'mermaid',
        sourceDocId: null,
        subjectId: subjects[1].id,
        definition: {
          type: 'mermaid',
          code: 'graph TD\n    A[Branch A] --> C[Headquarters]\n    B[Branch B] --> C\n    C --> D[Data Center]\n    A -.->|VPN| B',
          title: 'Company Network Topology',
        },
        renderedUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  })
  console.log('📊 Created sample diagrams')

  // Create sample quizzes
  const quiz2 = await prisma.quiz.create({
    data: {
      userId: students[0].id,
      title: 'Data Structures Midterm Practice',
      description: 'Practice quiz for CS201 midterm',
      subjectId: subjects[0].id,
      topic: 'Trees and Graphs',
      difficulty: 'MEDIUM',
      questions: [
        { question: 'What is the maximum number of nodes at level k in a binary tree?', options: ['2^k', '2^(k-1)', 'k^2', '2k'], correct: 0 },
        { question: 'Which traversal visits nodes in ascending order in a BST?', options: ['Preorder', 'Inorder', 'Postorder', 'Level-order'], correct: 1 },
        { question: 'What is the time complexity of finding an element in a balanced BST?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 1 },
        { question: 'What is a heap property?', options: ['Parent > children (max-heap)', 'Parent < children (min-heap)', 'Both A and B depending on heap type', 'Neither'], correct: 2 },
      ],
      timeLimit: 30,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await prisma.quizAttempt.create({
    data: {
      quizId: quiz2.id,
      userId: students[0].id,
      answers: [0, 1, 1, 2],
      score: 75,
      maxScore: 100,
      startedAt: new Date('2024-10-10T10:00:00'),
      completedAt: new Date('2024-10-10T10:25:00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log('❓ Created sample quiz')

  console.log('✨ Database seed completed successfully!')
  console.log('\n📋 Demo Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👨‍💼 Admin:     admin@techuniversity.edu / password123')
  console.log('👨‍🏫 Lecturer 1: prof.smith@techuniversity.edu / password123')
  console.log('👨‍🏫 Lecturer 2: prof.jones@techuniversity.edu / password123')
  console.log('👨‍🏫 Mentor:    mentor.wilson@techuniversity.edu / password123')
  console.log('👨‍🎓 Student 1: alice.student@techuniversity.edu / password123')
  console.log('👨‍🎓 Student 2: bob.student@techuniversity.edu / password123')
  console.log('👨‍🎓 Student 3: carol.student@techuniversity.edu / password123')
  console.log('👨‍🎓 Student 4: david.student@techuniversity.edu / password123')
  console.log('👨‍🎓 Student 5: eve.student@techuniversity.edu / password123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })