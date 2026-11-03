import {
  UsabilityTest,
  TestTask,
  ParticipantSession,
  SusResult,
  SyntheticPersona,
  UXInsight,
  TaskMetricsDetail,
  FunnelStage,
  HeatmapPoint,
  ComponentClickZone,
  ScreenHeatmapData
} from '../types';

export const INITIAL_TESTS: UsabilityTest[] = [
  {
    id: 'TEST-U92DU',
    name: 'Jornada de Empréstimo com Garantia (Figma Make)',
    description: 'Avaliação de usabilidade da jornada de simulação de crédito com garantia de imóvel, preenchimento de dados cadastrais e envio de proposta.',
    researchGoal: 'Avaliar a clareza e facilidade de realização da simulação de empréstimo e envio da proposta sem dúvidas no valor das parcelas.',
    productName: 'Simulador de Crédito Imobiliário',
    researcherName: 'Ana Silva (Staff UX Researcher)',
    category: 'Mobile App / Fintech',
    status: 'Em andamento',
    createdAt: '2026-08-28T14:30:00.000Z',
    updatedAt: '2026-09-04T12:00:00.000Z',
    prototypeUrl: 'https://evil-chess-37482794.figma.site',
    trackingId: 'UX-QK8UY',
    shareUrl: '/run/TEST-U92DU',
    totalParticipants: 24,
    averageSusScore: 81.5,
    averageSuccessRate: 87.5,
    averageDurationSeconds: 154, // 2m 34s
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: true,
      qualitativeComments: true,
      customQuestions: true,
      clickZoning: true
    },
    customQuestions: [
      {
        id: 'CQ-1',
        question: 'Qual foi sua maior facilidade ou dificuldade ao simular o valor e prazo das parcelas?',
        type: 'open_text',
        required: true
      },
      {
        id: 'CQ-2',
        question: 'Quão clara foi a explicação sobre a taxa de juros e o Custo Efetivo Total (CET)?',
        type: 'likert_scale',
        required: false
      }
    ],
    tasks: [
      {
        id: 'TASK-1',
        order: 1,
        title: 'Simular empréstimo com garantia de imóvel',
        description: 'Simula o momento em que o participante preenche o valor desejado e prazo.',
        instruction: 'Selecione o valor do empréstimo de R$ 150.000, ajuste o prazo para 120 meses e clique em "Continuar Simulação".',
        expectedPath: ['simulacao', 'dados-proponente'],
        successCriteria: 'Avançar para a etapa de preenchimento dos dados do proponente.',
        errorCriteria: 'Dificuldade em ajustar os campos de simulação ou abandono.'
      },
      {
        id: 'TASK-2',
        order: 2,
        title: 'Preencher dados do proponente e renda',
        description: 'Avalia a facilidade de preenchimento dos dados do participante e validação em tempo real.',
        instruction: 'Informe seus dados cadastrais, renda mensal comprovada e valor estimado do imóvel em garantia.',
        expectedPath: ['dados-proponente', 'revisao-proposta'],
        successCriteria: 'Chegar à tela de análise e revisão de proposta calculada.',
        errorCriteria: 'Erros repetidos em validações cadastrais ou abandono.'
      },
      {
        id: 'TASK-3',
        order: 3,
        title: 'Revisar proposta e confirmar envio',
        description: 'Avalia a revisão do Custo Efetivo Total (CET) e confirmação da solicitação.',
        instruction: 'Revise as condições da simulação calculada e confirme o envio da sua proposta de crédito.',
        expectedPath: ['revisao-proposta', 'proposta-enviada'],
        successCriteria: 'Visualizar a confirmação de proposta enviada com sucesso.',
        errorCriteria: 'Abandono na tela de revisão antes de confirmar a solicitação.'
      }
    ]
  },
  {
    id: 'TEST-B93KD',
    name: 'E-commerce: Checkout Transparente & Cupons',
    description: 'Teste de usabilidade do fluxo de checkout de 1 página com aplicação de cupom promocional e escolha de frete.',
    researchGoal: 'Identificar se o campo de cupom colapsado gera abandono ou dúvidas durante o pagamento.',
    productName: 'Zattini Store Web',
    researcherName: 'Carlos Eduardo (Senior Product Designer)',
    category: 'E-commerce',
    status: 'Finalizado',
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-25T18:00:00.000Z',
    prototypeUrl: 'https://www.figma.com/proto/sample-prototype/Store-Checkout?scaling=scale-down',
    trackingId: 'UX-ZAT-01',
    shareUrl: '?test=TEST-B93KD',
    totalParticipants: 35,
    averageSusScore: 84.2,
    averageSuccessRate: 91.4,
    averageDurationSeconds: 88,
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: false,
      qualitativeComments: true,
      customQuestions: true,
      clickZoning: true
    },
    customQuestions: [
      {
        id: 'CQ-ECOM-1',
        question: 'Onde você esperava encontrar o campo para inserir o cupom de desconto?',
        type: 'open_text',
        required: true
      }
    ],
    tasks: [
      {
        id: 'TASK-B1',
        order: 1,
        title: 'Aplicar cupom e concluir compra',
        description: 'Fluxo rápido de checkout.',
        instruction: 'Aplique o cupom "DESCONTO10" e conclua o pagamento com cartão salvo.',
        expectedPath: ['carrinho', 'checkout', 'confirmacao'],
        successCriteria: 'Tela de pedido confirmado com valor atualizado.',
        errorCriteria: 'Erro de validação do cupom ou desistência antes de pagar.'
      }
    ]
  },
  {
    id: 'TEST-C41LQ',
    name: 'App Mobile Fintech: Transferência Instantânea & Biometria',
    description: 'Novo fluxo mobile de transferência com autenticação biométrica e confirmação de comprovante.',
    researchGoal: 'Validar se usuários realizam transferências em menos de 45 segundos com total sensação de segurança.',
    productName: 'Neon Mobile App',
    researcherName: 'Mariana Duarte (UX Researcher)',
    category: 'Mobile App / Fintech',
    status: 'Publicado',
    createdAt: '2026-09-02T09:15:00.000Z',
    updatedAt: '2026-09-03T11:45:00.000Z',
    prototypeUrl: 'https://www.figma.com/proto/sample-prototype/App-Fintech?scaling=scale-down',
    trackingId: 'UX-NEON-04',
    shareUrl: '?test=TEST-C41LQ',
    totalParticipants: 18,
    averageSusScore: 88.0,
    averageSuccessRate: 94.4,
    averageDurationSeconds: 42,
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: true,
      qualitativeComments: true,
      customQuestions: true,
      clickZoning: true
    },
    tasks: [
      {
        id: 'TASK-C1',
        order: 1,
        title: 'Enviar R$ 50,00 via Chave Pix',
        description: 'Transferência rápida via chave.',
        instruction: 'Envie R$ 50,00 para a chave cadastrada e confirme com biometria facial.',
        expectedPath: ['home', 'transferir', 'autenticacao', 'comprovante'],
        successCriteria: 'Comprovante emitido com sucesso.',
        errorCriteria: 'Erro de senha ou clique repetido fora dos campos.'
      }
    ]
  },
  {
    id: 'TEST-D88ZT',
    name: 'Portal de Saúde: Agendamento de Consulta e Telemedicina',
    description: 'Fluxo para encontrar médicos especialistas, selecionar horário disponível e confirmar agendamento de teleconsulta.',
    researchGoal: 'Avaliar a usabilidade da seleção de data e clareza dos requisitos para a chamada de vídeo.',
    productName: 'Viva Bem Health Care',
    researcherName: 'Rafael Gomes (Product Design Lead)',
    category: 'Healthtech',
    status: 'Rascunho',
    createdAt: '2026-09-03T16:00:00.000Z',
    updatedAt: '2026-09-04T09:30:00.000Z',
    prototypeUrl: 'https://www.figma.com/proto/sample-prototype/Health-Schedule?scaling=scale-down',
    trackingId: 'UX-HEALTH-01',
    shareUrl: '?test=TEST-D88ZT',
    totalParticipants: 0,
    averageSusScore: 0,
    averageSuccessRate: 0,
    averageDurationSeconds: 0,
    metricConfig: {
      taskSuccessRate: true,
      completionRate: true,
      taskDuration: true,
      screenDuration: true,
      clickCount: true,
      errorClicks: true,
      backReturns: true,
      abandonmentRate: true,
      pathDeviation: true,
      mostUsedPath: true,
      idealPath: true,
      sus: true,
      nps: true,
      qualitativeComments: true
    },
    tasks: [
      {
        id: 'TASK-D1',
        order: 1,
        title: 'Agendar teleconsulta com Cardiologista',
        description: 'Seleção de médico e data.',
        instruction: 'Busque por Cardiologista, escolha o primeiro horário da manhã e confirme.',
        expectedPath: ['busca', 'medico-perfil', 'calendario', 'confirmacao'],
        successCriteria: 'Confirmação de agendamento exibida.',
        errorCriteria: 'Desistir antes da confirmação ou não localizar a especialidade.'
      }
    ]
  }
];

export const MOCK_PARTICIPANTS: ParticipantSession[] = [
  {
    sessionId: 'SESS-001',
    testId: 'TEST-U92DU',
    participantName: 'Lucas Albuquerque',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T08:31:02.000Z',
    endTime: '2026-09-04T08:34:21.000Z',
    durationSeconds: 199,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 18,
    errorCount: 2,
    returnCount: 1,
    susScore: 82.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: [
      { eventId: 'EVT-01', sessionId: 'SESS-001', testId: 'TEST-U92DU', timestamp: '2026-09-04T08:31:02.000Z', screen: 'home', eventType: 'SESSION_START', currentScreen: 'home' },
      { eventId: 'EVT-02', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-1', timestamp: '2026-09-04T08:31:05.000Z', screen: 'home', eventType: 'TASK_START', currentScreen: 'home' },
      { eventId: 'EVT-03', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-1', timestamp: '2026-09-04T08:31:18.000Z', screen: 'home', element: 'menu-seguro-auto', eventType: 'CLICK', previousScreen: 'home', currentScreen: 'seguro-auto' },
      { eventId: 'EVT-04', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-1', timestamp: '2026-09-04T08:31:44.000Z', screen: 'seguro-auto', element: 'btn-iniciar-cotacao', eventType: 'CLICK', previousScreen: 'seguro-auto', currentScreen: 'dados-veiculo' },
      { eventId: 'EVT-05', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-1', timestamp: '2026-09-04T08:32:00.000Z', screen: 'dados-veiculo', eventType: 'TASK_SUCCESS', currentScreen: 'dados-veiculo' },
      { eventId: 'EVT-06', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:32:02.000Z', screen: 'dados-veiculo', eventType: 'TASK_START', currentScreen: 'dados-veiculo' },
      { eventId: 'EVT-07', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:32:30.000Z', screen: 'dados-veiculo', element: 'btn-avancar-coberturas', eventType: 'CLICK', previousScreen: 'dados-veiculo', currentScreen: 'coberturas' },
      { eventId: 'EVT-08', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:33:02.000Z', screen: 'coberturas', element: 'btn-voltar', eventType: 'BACK', previousScreen: 'coberturas', currentScreen: 'dados-veiculo' },
      { eventId: 'EVT-09', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:33:20.000Z', screen: 'dados-veiculo', element: 'btn-avancar-coberturas', eventType: 'RETURN', previousScreen: 'dados-veiculo', currentScreen: 'coberturas' },
      { eventId: 'EVT-10', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:33:48.000Z', screen: 'coberturas', element: 'btn-revisar-proposta', eventType: 'CLICK', previousScreen: 'coberturas', currentScreen: 'resumo' },
      { eventId: 'EVT-11', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-2', timestamp: '2026-09-04T08:33:50.000Z', screen: 'resumo', eventType: 'TASK_SUCCESS', currentScreen: 'resumo' },
      { eventId: 'EVT-12', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-3', timestamp: '2026-09-04T08:33:52.000Z', screen: 'resumo', eventType: 'TASK_START', currentScreen: 'resumo' },
      { eventId: 'EVT-13', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-3', timestamp: '2026-09-04T08:34:10.000Z', screen: 'resumo', element: 'btn-confirmar-proposta', eventType: 'CLICK', previousScreen: 'resumo', currentScreen: 'sucesso' },
      { eventId: 'EVT-14', sessionId: 'SESS-001', testId: 'TEST-U92DU', taskId: 'TASK-3', timestamp: '2026-09-04T08:34:12.000Z', screen: 'sucesso', eventType: 'TASK_SUCCESS', currentScreen: 'sucesso' },
      { eventId: 'EVT-15', sessionId: 'SESS-001', testId: 'TEST-U92DU', timestamp: '2026-09-04T08:34:15.000Z', screen: 'sus', eventType: 'SUS_START', currentScreen: 'sus' },
      { eventId: 'EVT-16', sessionId: 'SESS-001', testId: 'TEST-U92DU', timestamp: '2026-09-04T08:34:21.000Z', screen: 'sus', eventType: 'SUS_COMPLETE', metadata: { score: 82.5 }, currentScreen: 'sus' }
    ]
  },
  {
    sessionId: 'SESS-002',
    testId: 'TEST-U92DU',
    participantName: 'Juliana Mendes',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T09:12:00.000Z',
    endTime: '2026-09-04T09:14:40.000Z',
    durationSeconds: 160,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 14,
    errorCount: 0,
    returnCount: 0,
    susScore: 85.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-003',
    testId: 'TEST-U92DU',
    participantName: 'Rafael Guimarães',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T10:00:15.000Z',
    endTime: '2026-09-04T10:03:55.000Z',
    durationSeconds: 220,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 24,
    errorCount: 3,
    returnCount: 2,
    susScore: 72.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-004',
    testId: 'TEST-U92DU',
    participantName: 'Beatriz Fonseca',
    participantType: 'human',
    status: 'Abandonado',
    startTime: '2026-09-04T10:30:00.000Z',
    endTime: '2026-09-04T10:32:45.000Z',
    durationSeconds: 165,
    tasksCompleted: 1,
    totalTasks: 3,
    successRate: 33.3,
    clickCount: 16,
    errorCount: 4,
    returnCount: 2,
    susScore: 45.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo']
    },
    events: []
  },
  {
    sessionId: 'SESS-005',
    testId: 'TEST-U92DU',
    participantName: 'Thiago Nogueira',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T11:05:00.000Z',
    endTime: '2026-09-04T11:07:35.000Z',
    durationSeconds: 155,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 15,
    errorCount: 1,
    returnCount: 0,
    susScore: 87.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-006',
    testId: 'TEST-U92DU',
    participantName: 'Camila Peixoto',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T11:20:00.000Z',
    endTime: '2026-09-04T11:23:10.000Z',
    durationSeconds: 190,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 19,
    errorCount: 2,
    returnCount: 1,
    susScore: 77.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-007',
    testId: 'TEST-U92DU',
    participantName: 'Diego Farias',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T11:45:00.000Z',
    endTime: '2026-09-04T11:47:15.000Z',
    durationSeconds: 135,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 13,
    errorCount: 0,
    returnCount: 0,
    susScore: 92.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-008',
    testId: 'TEST-U92DU',
    participantName: 'Vanessa Castro',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T12:00:00.000Z',
    endTime: '2026-09-04T12:03:05.000Z',
    durationSeconds: 185,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 17,
    errorCount: 1,
    returnCount: 1,
    susScore: 80.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-009',
    testId: 'TEST-U92DU',
    participantName: 'Rodrigo Sampaio',
    participantType: 'human',
    status: 'Abandonado',
    startTime: '2026-09-04T12:15:00.000Z',
    endTime: '2026-09-04T12:18:20.000Z',
    durationSeconds: 200,
    tasksCompleted: 1,
    totalTasks: 3,
    successRate: 33.3,
    clickCount: 21,
    errorCount: 5,
    returnCount: 3,
    susScore: 50.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo']
    },
    events: []
  },
  {
    sessionId: 'SESS-010',
    testId: 'TEST-U92DU',
    participantName: 'Patrícia Rocha',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-04T12:30:00.000Z',
    endTime: '2026-09-04T12:32:40.000Z',
    durationSeconds: 160,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 14,
    errorCount: 0,
    returnCount: 0,
    susScore: 85.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  // Synthetic Personas entries as participants for unified analytics
  {
    sessionId: 'SESS-SYN-01',
    testId: 'TEST-U92DU',
    participantName: 'Persona: Júlia (Mobile-first Cautelosa)',
    participantType: 'synthetic',
    status: 'Concluído',
    startTime: '2026-09-04T07:10:00.000Z',
    endTime: '2026-09-04T07:13:10.000Z',
    durationSeconds: 190,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 20,
    errorCount: 2,
    returnCount: 1,
    susScore: 77.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-SYN-02',
    testId: 'TEST-U92DU',
    participantName: 'Persona: Carlos (Tradicional 50+)',
    participantType: 'synthetic',
    status: 'Concluído',
    startTime: '2026-09-04T07:15:00.000Z',
    endTime: '2026-09-04T07:19:00.000Z',
    durationSeconds: 240,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 26,
    errorCount: 4,
    returnCount: 2,
    susScore: 70.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-SYN-03',
    testId: 'TEST-U92DU',
    participantName: 'Persona: Leonardo (Power User Tech)',
    participantType: 'synthetic',
    status: 'Concluído',
    startTime: '2026-09-04T07:20:00.000Z',
    endTime: '2026-09-04T07:21:40.000Z',
    durationSeconds: 100,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 12,
    errorCount: 0,
    returnCount: 0,
    susScore: 90.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-011',
    testId: 'TEST-U92DU',
    participantName: 'Aline Barbosa',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T15:00:00.000Z',
    endTime: '2026-09-03T15:02:40.000Z',
    durationSeconds: 160,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 15,
    errorCount: 1,
    returnCount: 0,
    susScore: 82.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-012',
    testId: 'TEST-U92DU',
    participantName: 'Felipe Tavares',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T15:20:00.000Z',
    endTime: '2026-09-03T15:23:05.000Z',
    durationSeconds: 185,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 17,
    errorCount: 2,
    returnCount: 1,
    susScore: 75.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-013',
    testId: 'TEST-U92DU',
    participantName: 'Tatiane Ramos',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T16:00:00.000Z',
    endTime: '2026-09-03T16:02:30.000Z',
    durationSeconds: 150,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 14,
    errorCount: 0,
    returnCount: 0,
    susScore: 85.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-014',
    testId: 'TEST-U92DU',
    participantName: 'Marcelo Pires',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T16:30:00.000Z',
    endTime: '2026-09-03T16:33:10.000Z',
    durationSeconds: 190,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 18,
    errorCount: 2,
    returnCount: 1,
    susScore: 77.5,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-015',
    testId: 'TEST-U92DU',
    participantName: 'Helena Ribeiro',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T17:00:00.000Z',
    endTime: '2026-09-03T17:02:20.000Z',
    durationSeconds: 140,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 13,
    errorCount: 0,
    returnCount: 0,
    susScore: 90.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-016',
    testId: 'TEST-U92DU',
    participantName: 'Gustavo Lima',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T17:30:00.000Z',
    endTime: '2026-09-03T17:33:00.000Z',
    durationSeconds: 180,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 16,
    errorCount: 1,
    returnCount: 1,
    susScore: 80.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  },
  {
    sessionId: 'SESS-017',
    testId: 'TEST-U92DU',
    participantName: 'Renata Guimarães',
    participantType: 'human',
    status: 'Concluído',
    startTime: '2026-09-03T18:00:00.000Z',
    endTime: '2026-09-03T18:02:40.000Z',
    durationSeconds: 160,
    tasksCompleted: 3,
    totalTasks: 3,
    successRate: 100,
    clickCount: 14,
    errorCount: 0,
    returnCount: 0,
    susScore: 85.0,
    actualPaths: {
      'TASK-1': ['home', 'seguro-auto', 'dados-veiculo'],
      'TASK-2': ['dados-veiculo', 'coberturas', 'resumo'],
      'TASK-3': ['resumo', 'sucesso']
    },
    events: []
  }
];

export const MOCK_TASK_METRICS: TaskMetricsDetail[] = [
  {
    taskId: 'TASK-1',
    title: 'Encontrar uma cotação de Seguro Auto',
    participants: 20,
    successRate: 95.0,
    completionRate: 95.0,
    averageTimeSeconds: 42,
    medianTimeSeconds: 38,
    totalClicks: 84,
    errorClicks: 6,
    returnsCount: 1,
    abandonmentCount: 0,
    idealPathRate: 90.0,
    expectedPath: ['home', 'seguro-auto', 'dados-veiculo'],
    mostUsedPath: ['home', 'seguro-auto', 'dados-veiculo'],
    pathFrequencies: [
      { path: ['home', 'seguro-auto', 'dados-veiculo'], count: 18, percentage: 90.0 },
      { path: ['home', 'menu-geral', 'seguro-auto', 'dados-veiculo'], count: 2, percentage: 10.0 }
    ]
  },
  {
    taskId: 'TASK-2',
    title: 'Configurar e escolher coberturas adequadas',
    participants: 20,
    successRate: 85.0,
    completionRate: 85.0,
    averageTimeSeconds: 88,
    medianTimeSeconds: 82,
    totalClicks: 210,
    errorClicks: 32,
    returnsCount: 8, // 8 out of 20 = 40% (approx 38%)
    abandonmentCount: 2,
    idealPathRate: 61.0,
    expectedPath: ['dados-veiculo', 'coberturas', 'resumo'],
    mostUsedPath: ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'],
    pathFrequencies: [
      { path: ['dados-veiculo', 'coberturas', 'resumo'], count: 11, percentage: 61.1 },
      { path: ['dados-veiculo', 'coberturas', 'dados-veiculo', 'coberturas', 'resumo'], count: 7, percentage: 38.9 }
    ]
  },
  {
    taskId: 'TASK-3',
    title: 'Revisar e confirmar proposta',
    participants: 18,
    successRate: 100.0,
    completionRate: 100.0,
    averageTimeSeconds: 37,
    medianTimeSeconds: 34,
    totalClicks: 52,
    errorClicks: 2,
    returnsCount: 0,
    abandonmentCount: 0,
    idealPathRate: 100.0,
    expectedPath: ['resumo', 'sucesso'],
    mostUsedPath: ['resumo', 'sucesso'],
    pathFrequencies: [
      { path: ['resumo', 'sucesso'], count: 18, percentage: 100.0 }
    ]
  }
];

export const MOCK_SUS_RESULT: SusResult = {
  averageScore: 78.5,
  classification: 'Bom',
  totalResponses: 18,
  questionAverages: [4.2, 2.1, 4.0, 1.9, 4.3, 2.0, 4.4, 2.2, 4.1, 1.8],
  scoreDistribution: [
    { range: '90 - 100 (Excelente)', count: 4 },
    { range: '75 - 89 (Bom)', count: 10 },
    { range: '60 - 74 (Neutro)', count: 2 },
    { range: '45 - 59 (Ruim)', count: 2 },
    { range: '< 45 (Muito Ruim)', count: 0 }
  ],
  perceptionVsBehavior: {
    susScore: 78.5,
    successRate: 82.0,
    averageDuration: '02:47',
    pathDeviationRate: 39.0,
    discrepancyDetected: true,
    discrepancyMessage: 'Apesar da percepção positiva registrada pelo SUS (78,5 — Bom), os dados comportamentais indicam fricção considerável na etapa de Coberturas: 38% dos participantes retornaram à tela anterior e 39% desviaram do caminho ideal.'
  }
};

export const MOCK_SYNTHETIC_PERSONAS: SyntheticPersona[] = [
  {
    personaId: 'PER-01',
    personaName: 'Júlia Prado (Millennial Mobile-First)',
    personaProfile: '28 anos, usuária assídua de smartphones, busca agilidade e clareza nos preços sem termos técnicos.',
    behaviorProfile: 'Velocidade alta de escaneamento visual, sensível a textos longos, clica rápido em botões primários.',
    status: 'Concluído',
    result: {
      successRate: 100,
      durationSeconds: 190,
      frictionObserved: 'Hesitou na escolha de franquia normal vs reduzida; retornou para conferir o valor do veículo.',
      susEstimated: 77.5
    }
  },
  {
    personaId: 'PER-02',
    personaName: 'Carlos Mendonça (Conservador Cauteloso)',
    personaProfile: '54 anos, acostumado a corretores tradicionais, lê minuciosamente cada cláusula e valor de franquia.',
    behaviorProfile: 'Taxa baixa de cliques impulsivos, releituras frequentes, retorno para checar informações anteriores.',
    status: 'Concluído',
    result: {
      successRate: 100,
      durationSeconds: 240,
      frictionObserved: 'Insegurança na tela de coberturas com 2 retornos para checar se seguro a terceiros cobria danos corporais.',
      susEstimated: 70.0
    }
  },
  {
    personaId: 'PER-03',
    personaName: 'Leonardo Vaz (Power User & Dev)',
    personaProfile: '33 anos, familiarizado com SaaS modernos, focado em comparar tabelas de benefícios em poucos segundos.',
    behaviorProfile: 'Caminho estritamente linear, quase nenhum erro de clique, uso ágil do scroll e atalhos.',
    status: 'Concluído',
    result: {
      successRate: 100,
      durationSeconds: 100,
      frictionObserved: 'Nenhuma fricção impeditiva; sugeriu tooltip explicativo para valores de guincho ilimitado.',
      susEstimated: 90.0
    }
  }
];

export const MOCK_INSIGHTS: UXInsight[] = [
  {
    id: 'INS-01',
    severity: 'friction',
    title: 'Fricção na seleção de coberturas e modalidades de franquia',
    evidence: [
      '38% dos participantes retornaram à etapa de Dados do Veículo após entrar em Coberturas.',
      'O maior tempo médio de toda a jornada ocorreu nesta etapa (88 segundos).',
      'Registrados 32 cliques em áreas não interativas ou com refações na tabela comparativa.'
    ],
    hypothesis: 'Isso pode indicar dificuldade de compreensão da hierarquia das opções apresentadas e incerteza sobre como o modelo do veículo afeta o valor da franquia.',
    recommendation: 'Adicionar comparador lado a lado com resumo contextual do veículo no topo e cards explicativos simples para Franquia Normal vs Reduzida.',
    impact: 'Redução estimada de 30% nos retornos e aumento de 8% na taxa de conclusão direta da tarefa.',
    affectedTask: 'TASK-2'
  },
  {
    id: 'INS-02',
    severity: 'critical',
    title: 'Abandono na transição de coberturas para o resumo de proposta',
    evidence: [
      '2 participantes abandonaram definitivamente o teste na tela de Coberturas.',
      'Ambos os participantes registraram mais de 4 cliques errôneos e 2 tentativas de retorno antes de fechar a aba.'
    ],
    hypothesis: 'A ausência de sinalização clara de que a contratação ainda não é definitiva ou cobrança imediata pode gerar apreensão.',
    recommendation: 'Inserir microcopy de segurança: "Você poderá revisar todos os detalhes antes de pagar qualquer valor" próximo ao botão Continuar.',
    impact: 'Prevenção de abandono por receio de cobrança precoce.',
    affectedTask: 'TASK-2'
  },
  {
    id: 'INS-03',
    severity: 'attention',
    title: 'Desvio de 39% em relação ao caminho ideal',
    evidence: [
      'Caminho ideal: 61% de adesão.',
      'Desvio registrado: 39% dos usuários precisaram de etapas extras para completar a contratação.'
    ],
    hypothesis: 'Usuários sentem necessidade de checar novamente os dados antes de prosseguir, gerando navegação pendular (vai e volta).',
    recommendation: 'Implementar mini painel flutuante de resumo lateral ou progress tracker interativo com visualização instantânea.',
    impact: 'Acelera a jornada média de 167s para menos de 120s.',
    affectedTask: 'TASK-2'
  },
  {
    id: 'INS-04',
    severity: 'positive',
    title: 'Excelente desempenho no início da cotação e revisão final',
    evidence: [
      '95% de taxa de sucesso na Tarefa 1 com tempo médio de apenas 42 segundos.',
      '100% de conversão na Tarefa 3 com feedback positivo no fechamento da proposta.'
    ],
    hypothesis: 'A identidade visual e a busca por marca/modelo de veículo foram intuitivas para a grande maioria dos participantes.',
    recommendation: 'Manter a simplicidade da primeira tela e replicar o padrão de cartões limpos nas etapas subsequentes.',
    impact: 'Alta retenção no topo do funil de cotação.',
    affectedTask: 'TASK-1'
  }
];

export const MOCK_FUNNEL: FunnelStage[] = [
  { label: 'Participantes Iniciaram', count: 20, percentage: 100, dropoffPercentage: 0 },
  { label: 'Tarefa 1: Início Cotação', count: 19, percentage: 95, dropoffPercentage: 5 },
  { label: 'Tarefa 2: Coberturas', count: 17, percentage: 85, dropoffPercentage: 10 },
  { label: 'Tarefa 3: Resumo Final', count: 17, percentage: 85, dropoffPercentage: 0 },
  { label: 'Sucesso Total Concluído', count: 16, percentage: 80, dropoffPercentage: 5 }
];

export const MOCK_HEATMAP_POINTS: HeatmapPoint[] = [
  { id: 'H1', screen: 'coberturas', element: 'card-plano-completo', xPercent: 50, yPercent: 42, intensity: 'alta', clickCount: 48, isError: false },
  { id: 'H2', screen: 'coberturas', element: 'tooltip-franquia', xPercent: 72, yPercent: 35, intensity: 'alta', clickCount: 34, isError: false },
  { id: 'H3', screen: 'coberturas', element: 'badge-nao-clicavel', xPercent: 28, yPercent: 48, intensity: 'media', clickCount: 22, isError: true },
  { id: 'H4', screen: 'coberturas', element: 'btn-voltar-topo', xPercent: 12, yPercent: 18, intensity: 'media', clickCount: 16, isError: false },
  { id: 'H5', screen: 'coberturas', element: 'btn-avancar', xPercent: 50, yPercent: 88, intensity: 'alta', clickCount: 40, isError: false },
  { id: 'H6', screen: 'coberturas', element: 'texto-regulamento', xPercent: 48, yPercent: 70, intensity: 'baixa', clickCount: 9, isError: true }
];

export const OFFICIAL_SUS_QUESTIONS = [
  '1. Eu acho que gostaria de usar este sistema com frequência.',
  '2. Eu achei o sistema desnecessariamente complexo.',
  '3. Eu achei o sistema fácil de usar.',
  '4. Eu acho que precisaria do apoio de uma pessoa técnica para ser capaz de usar este sistema.',
  '5. Eu achei que as várias funções deste sistema estavam bem integradas.',
  '6. Eu achei que havia muita inconsistência neste sistema.',
  '7. Eu imagino que a maioria das pessoas aprenderia a usar este sistema muito rapidamente.',
  '8. Eu achei o sistema muito complicado de usar.',
  '9. Eu me senti muito confiante usando o sistema.',
  '10. Eu precisei aprender muitas coisas antes de conseguir usar este sistema.'
];

export const MOCK_COMPONENT_ZONES: ComponentClickZone[] = [
  {
    id: 'ZONE-01',
    screen: 'dashboard',
    componentName: 'Botão "Novo Projeto" (CTA Primário)',
    componentSelector: 'button#btn-create-project',
    bounds: { top: 18, left: 74, width: 20, height: 8 },
    clickCount: 142,
    errorClickCount: 3,
    deadClickCount: 1,
    percentageOfTotal: 52.4,
    classification: 'primary_action'
  },
  {
    id: 'ZONE-02',
    screen: 'dashboard',
    componentName: 'Barra de Busca e Filtro de Projetos',
    componentSelector: 'input#search-workspaces',
    bounds: { top: 18, left: 12, width: 45, height: 8 },
    clickCount: 56,
    errorClickCount: 0,
    deadClickCount: 2,
    percentageOfTotal: 20.7,
    classification: 'input_field'
  },
  {
    id: 'ZONE-03',
    screen: 'dashboard',
    componentName: 'Cards de Projetos Recentes',
    componentSelector: 'div.project-card-grid',
    bounds: { top: 38, left: 12, width: 82, height: 35 },
    clickCount: 48,
    errorClickCount: 4,
    deadClickCount: 6,
    percentageOfTotal: 17.7,
    classification: 'content_card'
  },
  {
    id: 'ZONE-04',
    screen: 'dashboard',
    componentName: 'Banner Estático (Sem Ação / Dead Click Zone)',
    componentSelector: 'div.promo-banner-badge',
    bounds: { top: 80, left: 12, width: 82, height: 12 },
    clickCount: 25,
    errorClickCount: 22,
    deadClickCount: 25,
    percentageOfTotal: 9.2,
    classification: 'dead_zone'
  },
  // Screen 2: Configuração e Permissões
  {
    id: 'ZONE-05',
    screen: 'configuracao',
    componentName: 'Input de E-mail de Membro',
    componentSelector: 'input#invite-member-email',
    bounds: { top: 25, left: 15, width: 50, height: 7 },
    clickCount: 88,
    errorClickCount: 2,
    deadClickCount: 0,
    percentageOfTotal: 38.6,
    classification: 'input_field'
  },
  {
    id: 'ZONE-06',
    screen: 'configuracao',
    componentName: 'Seletor de Nível de Permissão (Dropdown)',
    componentSelector: 'select#role-permission',
    bounds: { top: 25, left: 68, width: 22, height: 7 },
    clickCount: 64,
    errorClickCount: 8,
    deadClickCount: 5,
    percentageOfTotal: 28.1,
    classification: 'input_field'
  },
  {
    id: 'ZONE-07',
    screen: 'configuracao',
    componentName: 'Botão "Salvar e Continuar"',
    componentSelector: 'button#btn-save-continue',
    bounds: { top: 82, left: 65, width: 25, height: 9 },
    clickCount: 55,
    errorClickCount: 1,
    deadClickCount: 0,
    percentageOfTotal: 24.1,
    classification: 'primary_action'
  },
  {
    id: 'ZONE-08',
    screen: 'configuracao',
    componentName: 'Texto de Ajuda Não Clicável',
    componentSelector: 'span.help-tooltip-label',
    bounds: { top: 40, left: 15, width: 35, height: 6 },
    clickCount: 21,
    errorClickCount: 18,
    deadClickCount: 21,
    percentageOfTotal: 9.2,
    classification: 'dead_zone'
  }
];

export const MOCK_SCREEN_HEATMAPS: Record<string, ScreenHeatmapData> = {
  'SCREEN-001': {
    screenId: 'SCREEN-001',
    screenName: 'Corretor Online / Porto / Empréstimos e financiamento',
    totalClicks: 412,
    rageClicks: 8,
    deadClicks: 21,
    points: [
      { id: 'HP-PORTO-1', screen: 'SCREEN-001', element: 'rect#btn-continuar-simulacao', xPercent: 78, yPercent: 80, intensity: 'alta', clickCount: 142, isError: false },
      { id: 'HP-PORTO-2', screen: 'SCREEN-001', element: 'rect#btn-continuar-simulacao', xPercent: 76, yPercent: 79, intensity: 'alta', clickCount: 88, isError: false },
      { id: 'HP-PORTO-3', screen: 'SCREEN-001', element: 'input#quanto-precisa-slider', xPercent: 32, yPercent: 46, intensity: 'alta', clickCount: 74, isError: false },
      { id: 'HP-PORTO-4', screen: 'SCREEN-001', element: 'input#prazo-meses-slider', xPercent: 68, yPercent: 46, intensity: 'alta', clickCount: 65, isError: false },
      { id: 'HP-PORTO-5', screen: 'SCREEN-001', element: 'div.resultado-parcela-card', xPercent: 35, yPercent: 68, intensity: 'media', clickCount: 28, isError: false },
      { id: 'HP-PORTO-6', screen: 'SCREEN-001', element: 'div.garantia-imovel-info', xPercent: 76, yPercent: 65, intensity: 'baixa', clickCount: 15, isError: false }
    ],
    zones: [
      {
        id: 'Z-PORTO-1',
        screenId: 'SCREEN-001',
        componentName: 'Botão "Continuar Simulação"',
        componentSelector: 'rect#btn-continuar-simulacao',
        bounds: { x: 64.5, y: 76.6, width: 23.6, height: 6.2 },
        clicks: 230,
        percentageOfTotal: 55.8,
        classification: 'primary_action'
      },
      {
        id: 'Z-PORTO-2',
        screenId: 'SCREEN-001',
        componentName: 'Slider "Valor do Empréstimo"',
        componentSelector: 'input#quanto-precisa-slider',
        bounds: { x: 11.8, y: 37.7, width: 36.1, height: 16.1 },
        clicks: 74,
        percentageOfTotal: 18.0,
        classification: 'input_field'
      },
      {
        id: 'Z-PORTO-3',
        screenId: 'SCREEN-001',
        componentName: 'Slider "Prazo Desejado"',
        componentSelector: 'input#prazo-meses-slider',
        bounds: { x: 50.6, y: 37.7, width: 37.5, height: 16.1 },
        clicks: 65,
        percentageOfTotal: 15.8,
        classification: 'input_field'
      }
    ]
  },
  simulacao: {
    screenId: 'simulacao',
    screenName: 'Corretor Online / Porto / Empréstimos e financiamento',
    totalClicks: 412,
    rageClicks: 8,
    deadClicks: 21,
    points: [
      { id: 'HP-SIM-1', screen: 'simulacao', element: 'rect#btn-continuar-simulacao', xPercent: 78, yPercent: 80, intensity: 'alta', clickCount: 142, isError: false },
      { id: 'HP-SIM-2', screen: 'simulacao', element: 'input#quanto-precisa-slider', xPercent: 32, yPercent: 46, intensity: 'alta', clickCount: 74, isError: false },
      { id: 'HP-SIM-3', screen: 'simulacao', element: 'input#prazo-meses-slider', xPercent: 68, yPercent: 46, intensity: 'alta', clickCount: 65, isError: false }
    ],
    zones: []
  },
  dashboard: {
    screenId: 'dashboard',
    screenName: 'Dashboard Inicial do Workspace',
    totalClicks: 271,
    rageClicks: 14,
    deadClicks: 34,
    points: [
      { id: 'HP-1', screen: 'dashboard', element: 'button#btn-create-project', xPercent: 84, yPercent: 22, intensity: 'alta', clickCount: 86, isError: false },
      { id: 'HP-2', screen: 'dashboard', element: 'button#btn-create-project', xPercent: 82, yPercent: 21, intensity: 'alta', clickCount: 56, isError: false },
      { id: 'HP-3', screen: 'dashboard', element: 'input#search-workspaces', xPercent: 25, yPercent: 22, intensity: 'media', clickCount: 38, isError: false },
      { id: 'HP-4', screen: 'dashboard', element: 'input#search-workspaces', xPercent: 35, yPercent: 22, intensity: 'media', clickCount: 18, isError: false },
      { id: 'HP-5', screen: 'dashboard', element: 'div.project-card-grid', xPercent: 28, yPercent: 48, intensity: 'media', clickCount: 28, isError: false },
      { id: 'HP-6', screen: 'dashboard', element: 'div.project-card-grid', xPercent: 62, yPercent: 48, intensity: 'baixa', clickCount: 20, isError: false },
      { id: 'HP-7', screen: 'dashboard', element: 'div.promo-banner-badge', xPercent: 32, yPercent: 85, intensity: 'baixa', clickCount: 15, isError: true },
      { id: 'HP-8', screen: 'dashboard', element: 'div.promo-banner-badge', xPercent: 55, yPercent: 85, intensity: 'baixa', clickCount: 10, isError: true }
    ],
    zones: MOCK_COMPONENT_ZONES.filter((z) => z.screen === 'dashboard')
  },
  configuracao: {
    screenId: 'configuracao',
    screenName: 'Configuração & Membros do Projeto',
    totalClicks: 228,
    rageClicks: 19,
    deadClicks: 26,
    points: [
      { id: 'HP-9', screen: 'configuracao', element: 'input#invite-member-email', xPercent: 35, yPercent: 28, intensity: 'alta', clickCount: 88, isError: false },
      { id: 'HP-10', screen: 'configuracao', element: 'select#role-permission', xPercent: 78, yPercent: 28, intensity: 'alta', clickCount: 64, isError: false },
      { id: 'HP-11', screen: 'configuracao', element: 'button#btn-save-continue', xPercent: 77, yPercent: 86, intensity: 'alta', clickCount: 55, isError: false },
      { id: 'HP-12', screen: 'configuracao', element: 'span.help-tooltip-label', xPercent: 26, yPercent: 43, intensity: 'media', clickCount: 21, isError: true }
    ],
    zones: MOCK_COMPONENT_ZONES.filter((z) => z.screen === 'configuracao')
  }
};
