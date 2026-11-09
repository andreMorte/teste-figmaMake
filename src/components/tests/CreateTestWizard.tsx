import React, { useState } from 'react';
import {
  UsabilityTest,
  TestTask,
  MetricConfig,
  CustomQuestion,
  CustomQuestionType
} from '../../types';
import {
  createTest
} from '../../services/dataService';
import { isFigmaUrl, toFigmaEmbedUrl, getShareableTestUrl } from '../../utils/figmaUtils';
import { ScreenMapper, getTaskSteps, withTaskSteps } from './ScreenMapper';
import { MetricsStep } from './MetricsStep';
import { HypothesesEditor } from './HypothesesEditor';
import { DEFAULT_NPS, DEFAULT_SUS_QUESTIONS } from '../../utils/surveyDefaults';
import { NpsConfig, Hypothesis } from '../../types';
import { MappedScreen } from '../../types';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ShieldCheck,
  Share2,
  Copy,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  Globe,
  Play,
  QrCode,
  Eye,
  HelpCircle,
  MessageSquare,
  Flame,
  MousePointer,
  Hash,
  Activity,
  Code,
  ScanSearch,
  MousePointerClick,
  Users,
  Bot,
  Lightbulb,
  ChevronDown
} from 'lucide-react';

interface CreateTestWizardProps {
  onSuccess: (createdTest: UsabilityTest) => void;
  onCancel: () => void;
  onOpenRunner: (testId: string, prototypeUrl?: string) => void;
}

export const CreateTestWizard: React.FC<CreateTestWizardProps> = ({
  onSuccess,
  onCancel,
  onOpenRunner
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  // Antes da Etapa 1: o teste é moderado (facilitador acompanha) ou não moderado (ajuda da IA para o participante)?
  const [moderation, setModeration] = useState<'moderated' | 'unmoderated' | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [step1Tried, setStep1Tried] = useState(false); // mostra erros só depois de tentar continuar

  // STEP 1 STATE: Info (Aberto para QUALQUER teste)
  const [name, setName] = useState('Novo Teste de Usabilidade de Produto');
  const [description, setDescription] = useState('Avaliação de usabilidade e compreensão da nova jornada digital.');
  const [researchGoal, setResearchGoal] = useState('Identificar fricções na navegação, taxa de sucesso nas tarefas e clareza das telas.');
  const [productName, setProductName] = useState('Plataforma Web / Mobile');
  const [researcherName, setResearcherName] = useState('Staff UX Researcher');
  const [participantLimit, setParticipantLimit] = useState<number>(10);
  const [category, setCategory] = useState<'SaaS / B2B' | 'E-commerce' | 'Mobile App / Fintech' | 'Healthtech' | 'Geral / Customizado'>('Geral / Customizado');

  // STEP 2 STATE: Tasks (Genéricas e abertas)
  const [tasks, setTasks] = useState<TestTask[]>([
    {
      id: 'TASK-1',
      order: 1,
      title: 'Localizar e iniciar o fluxo principal',
      description: 'Avaliar se o participante identifica com facilidade a ação primária na interface.',
      instruction: 'Navegue pela tela inicial, localize a opção principal do serviço e avance para a etapa seguinte.',
      objective: 'Verificar a clareza da chamada para ação (CTA) e arquitetura de informação.',
      expectedPath: ['home', 'fluxo-principal', 'detalhes'],
      successCriteria: 'Chegar à tela de detalhes do serviço com sucesso.',
      errorCriteria: 'Clicar repetidamente em áreas não interativas ou abandonar a tela.'
    },
    {
      id: 'TASK-2',
      order: 2,
      title: 'Completar formulário e confirmar solicitação',
      description: 'Avaliar o preenchimento de campos e envio dos dados.',
      instruction: 'Preencha as informações solicitadas no formulário e confirme o envio até a tela de confirmação.',
      objective: 'Mensurar erros de validação e tempo gasto no preenchimento.',
      expectedPath: ['detalhes', 'formulario', 'confirmacao'],
      successCriteria: 'Visualizar a tela final com a confirmação da operação.',
      errorCriteria: 'Desistir por confusão nos dados solicitados ou travar no formulário.'
    }
  ]);

  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(0);
  const [newStepName, setNewStepName] = useState('');

  // STEP 3 STATE: Custom Questions (Perguntas abertas e livres que o pesquisador define)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([
    {
      id: 'CQ-1',
      question: 'Qual foi o momento ou tela em que você encontrou maior facilidade ou dificuldade?',
      type: 'open_text',
      required: true
    },
    {
      id: 'CQ-2',
      question: 'Em uma escala de 1 a 5, quão intuitivo foi concluir a tarefa principal?',
      type: 'likert_scale',
      required: false
    }
  ]);

  // STEP 3 STATE: NPS e SUS editáveis
  const [npsConfig, setNpsConfig] = useState<NpsConfig>(DEFAULT_NPS);
  const [susQuestions, setSusQuestions] = useState<string[]>(DEFAULT_SUS_QUESTIONS);

  // STEP 3 STATE: Metric Config
  const [metrics, setMetrics] = useState<MetricConfig>({
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
  });

  // STEP 4 STATE: Prototype & Publication
  const [prototypeUrl, setPrototypeUrl] = useState('https://evil-chess-37482794.figma.site');
  // Mapeamento de cenários (Etapa 2)
  const [screenMap, setScreenMap] = useState<MappedScreen[]>([]);
  const [isMapperOpen, setIsMapperOpen] = useState(false);
  const [testId, setTestId] = useState(() => 'TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [trackingId, setTrackingId] = useState('UX-QK8UY');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState<boolean | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [createdTestResult, setCreatedTestResult] = useState<UsabilityTest | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedProtoDirect, setCopiedProtoDirect] = useState(false);

  // Preset Template loader
  const applyPresetTemplate = (type: 'saas' | 'ecom' | 'mobile' | 'blank') => {
    if (type === 'blank') {
      setName('');
      setDescription('');
      setResearchGoal('');
      setProductName('');
      setCategory('Geral / Customizado');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Primeira Tarefa do Teste',
          description: '',
          instruction: 'Descreva aqui o que o usuário deve fazer no protótipo...',
          expectedPath: ['tela-1', 'tela-2'],
          successCriteria: 'Concluir a ação solicitada.',
          errorCriteria: 'Desistir ou cometer erros.'
        }
      ]);
      setCustomQuestions([]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'saas') {
      setName('Plataforma SaaS: Onboarding & Criação de Projeto');
      setDescription('Avaliação de usabilidade da jornada de setup de novo projeto, convite de membros e permissões.');
      setResearchGoal('Avaliar a clareza e tempo de setup para novos gestores sem suporte.');
      setProductName('SaaS Platform');
      setCategory('SaaS / B2B');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Criar novo projeto no workspace',
          description: 'Avaliar localização do CTA de novo projeto.',
          instruction: 'Localize o botão de novo projeto, insira um nome e avance para o setup.',
          expectedPath: ['dashboard', 'novo-projeto', 'configuracao'],
          successCriteria: 'Acessar a tela de configuração de projeto.',
          errorCriteria: 'Clicar em menus incorretos mais de 3 vezes.'
        },
        {
          id: 'TASK-2',
          order: 2,
          title: 'Convidar equipe e atribuir papéis',
          description: 'Avaliar clareza dos níveis de permissão.',
          instruction: 'Adicione um membro com permissão de Editor e confirme o envio.',
          expectedPath: ['configuracao', 'membros', 'confirmacao'],
          successCriteria: 'Confirmação de convites enviados.',
          errorCriteria: 'Dúvidas nos papéis ou abandono da tela.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Quão claro foi o fluxo de permissões de membros da equipe?',
          type: 'likert_scale',
          required: true
        },
        {
          id: 'CQ-2',
          question: 'O que você melhoraria na criação do projeto?',
          type: 'open_text',
          required: false
        }
      ]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'ecom') {
      setName('E-commerce: Checkout & Aplicação de Cupom');
      setDescription('Teste do fluxo de 1-clique com cupom promocional e seleção de frete.');
      setResearchGoal('Investigar se a aplicação de cupom gera dúvidas ou abandono antes do pagamento.');
      setProductName('Loja Virtual');
      setCategory('E-commerce');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Aplicar cupom promocional no carrinho',
          description: 'Avaliar facilidade de encontrar o campo de cupom.',
          instruction: 'Insira o cupom promocional no carrinho e avance para o pagamento.',
          expectedPath: ['carrinho', 'cupom-aplicado', 'checkout'],
          successCriteria: 'Cupom aplicado com valor com desconto exibido.',
          errorCriteria: 'Erro de validação ou abandono antes de aplicar.'
        },
        {
          id: 'TASK-2',
          order: 2,
          title: 'Selecionar frete e confirmar pedido',
          description: 'Avaliar escolha de modalidade de entrega.',
          instruction: 'Escolha a opção de frete expresso e finalize o pedido.',
          expectedPath: ['checkout', 'frete', 'sucesso'],
          successCriteria: 'Tela de pedido confirmado com número de protocolo.',
          errorCriteria: 'Desistência no fechamento do pedido.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Você teve alguma dúvida ao aplicar o cupom de desconto?',
          type: 'open_text',
          required: true
        }
      ]);
      setActiveTaskIndex(0);
      return;
    }

    if (type === 'mobile') {
      setName('App Mobile: Envio de Transferência Instantânea');
      setDescription('Teste de usabilidade do fluxo rápido de transferência e confirmação biométrica.');
      setResearchGoal('Validar se usuários completam a operação com sensação de segurança em menos de 45s.');
      setProductName('Mobile App');
      setCategory('Mobile App / Fintech');
      setTasks([
        {
          id: 'TASK-1',
          order: 1,
          title: 'Realizar transferência para chave cadastrada',
          description: 'Fluxo rápido de transferência.',
          instruction: 'Transfira o valor solicitado para a chave informada e confirme com biometria.',
          expectedPath: ['home', 'transferir', 'confirmacao', 'comprovante'],
          successCriteria: 'Comprovante emitido com sucesso.',
          errorCriteria: 'Erro nos dados ou abandono na etapa de senha.'
        }
      ]);
      setCustomQuestions([
        {
          id: 'CQ-1',
          question: 'Em uma escala de 1 a 5, quão seguro você se sentiu durante o processo?',
          type: 'likert_scale',
          required: true
        }
      ]);
      setActiveTaskIndex(0);
    }
  };

  // Helper to add task
  const addTask = () => {
    const newTask: TestTask = {
      id: `TASK-${tasks.length + 1}`,
      order: tasks.length + 1,
      title: `Tarefa ${tasks.length + 1}`,
      description: 'Descrição do objetivo avaliado.',
      instruction: 'Instrução clara para o participante executar.',
      objective: 'Avaliar compreensão da interface.',
      expectedPath: ['inicio', 'etapa-1', 'sucesso'],
      successCriteria: 'Concluir a ação principal.',
      errorCriteria: 'Desistir ou cometer cliques errôneos.'
    };
    setTasks([...tasks, newTask]);
    setActiveTaskIndex(tasks.length);
  };

  const removeTask = (index: number) => {
    if (tasks.length <= 1) return;
    const updated = tasks.filter((_, i) => i !== index).map((t, idx) => ({ ...t, order: idx + 1 }));
    setTasks(updated);
    setActiveTaskIndex(Math.max(0, index - 1));
  };

  // Expected Path manipulation (mantém expectedPath[] e os detalhes de cada cenário sincronizados)
  const setTaskSteps = (taskIdx: number, steps: ReturnType<typeof getTaskSteps>) => {
    setTasks((prev) => prev.map((t, i) => (i === taskIdx ? withTaskSteps(t, steps) : t)));
  };

  const addPathStep = (taskIdx: number) => {
    if (!newStepName.trim()) return;
    const label = newStepName.trim();
    const cleanKey = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const mapped = screenMap.find((sc) => sc.screenId === cleanKey);
    setTaskSteps(taskIdx, [
      ...getTaskSteps(tasks[taskIdx], screenMap),
      { screenId: cleanKey, screenName: mapped?.screenName || label }
    ]);
    setNewStepName('');
  };

  const removePathStep = (taskIdx: number, stepIdx: number) => {
    setTaskSteps(taskIdx, getTaskSteps(tasks[taskIdx], screenMap).filter((_, i) => i !== stepIdx));
  };

  const movePathStep = (taskIdx: number, stepIdx: number, direction: 'up' | 'down') => {
    const steps = getTaskSteps(tasks[taskIdx], screenMap);
    const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    [steps[stepIdx], steps[targetIdx]] = [steps[targetIdx], steps[stepIdx]];
    setTaskSteps(taskIdx, steps);
  };

  // Custom Question manipulation
  const addCustomQuestion = () => {
    const newQ: CustomQuestion = {
      id: `CQ-${customQuestions.length + 1}`,
      question: 'Nova pergunta sobre a experiência do participante...',
      type: 'open_text',
      required: false
    };
    setCustomQuestions([...customQuestions, newQ]);
  };

  const removeCustomQuestion = (index: number) => {
    setCustomQuestions(customQuestions.filter((_, i) => i !== index));
  };

  const updateCustomQuestion = (index: number, updates: Partial<CustomQuestion>) => {
    const updated = [...customQuestions];
    updated[index] = { ...updated[index], ...updates };
    setCustomQuestions(updated);
  };

  // Metric toggle helper
  const toggleMetric = (key: keyof MetricConfig) => {
    setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Verify Prototype in Runtime (Strict anti-false-positive!)
  const handleVerifyPrototype = async () => {
    setIsVerifying(true);
    setVerificationPassed(null);
    setVerificationFeedback('');

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prototypeUrl: prototypeUrl.trim(),
          testId: testId.trim(),
          trackingId: trackingId.trim()
        })
      });

      const data = await res.json();
      if (data.verified) {
        setVerificationPassed(true);
        setVerificationFeedback(data.summaryMessage || 'Instrumentação validada com sucesso! Os bundles compilados contêm UXLab.init e os identificadores conferem.');
      } else {
        setVerificationPassed(false);
        setVerificationFeedback(data.summaryMessage || 'Não foi possível validar o protótipo com os dados informados.');
      }
    } catch {
      setVerificationPassed(false);
      setVerificationFeedback('Erro de conexão com o validador técnico.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Final Publish Handler
  const handlePublish = async () => {
    if (undetectable.length > 0) return; // sem fim mapeado o participante ficaria preso
    const newTest = await createTest({
      id: testId.trim() || undefined,
      name,
      description,
      researchGoal,
      productName,
      researcherName,
      participantLimit,
      moderation: moderation || 'unmoderated',
      hypotheses: hypotheses.filter((h) => h.statement.trim()),
      category,
      status: 'Publicado',
      prototypeUrl: prototypeUrl.trim(),
      trackingId: trackingId.trim(),
      tasks,
      screenMap,
      // perguntas desligadas ou sem texto não vão para o participante
      customQuestions: metrics.customQuestions === false ? [] : customQuestions.filter((q) => q.question.trim()),
      metricConfig: metrics,
      npsConfig: metrics.nps ? npsConfig : undefined,
      // só grava as afirmações do SUS se o time mudou o texto oficial
      susQuestions: metrics.sus && susQuestions.some((q, i) => q.trim() !== DEFAULT_SUS_QUESTIONS[i]) ? susQuestions.map((q, i) => q.trim() || DEFAULT_SUS_QUESTIONS[i]) : undefined
    });

    setCreatedTestResult(newTest);
  };

  const copySdkSnippet = () => {
    const code = `UXLab.init({\n  testId: "${testId.trim()}",\n  trackingId: "${trackingId.trim()}"\n});`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const copyLink = (testId: string, customProto?: string) => {
    const fullUrl = getShareableTestUrl(testId, customProto || prototypeUrl);
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyProtoDirectLink = (urlToCopy: string) => {
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setCopiedProtoDirect(true);
    setTimeout(() => setCopiedProtoDirect(false), 2000);
  };

  // Tela que encerra cada tarefa (mesma regra do participante): o fim mapeado da própria tarefa
  // ou o início mapeado da tarefa seguinte. Telas vazias (transição) não contam.
  const realScreens = new Set(
    screenMap.filter((m) => m.dialog || m.thumbnail || (m.actions || []).length || (m.inputs || []).length).map((m) => m.screenId)
  );
  const undetectable = tasks
    .map((t, i) => {
      const path = t.expectedPath.filter((id) => realScreens.has(id));
      const last = t.expectedPath.filter((id) => !screenMap.some((m) => m.screenId === id && !realScreens.has(id))).slice(-1)[0];
      const own = !!last && path.includes(last);
      const next = tasks[i + 1] ? tasks[i + 1].expectedPath.some((id) => realScreens.has(id)) : false;
      return own || next ? -1 : i;
    })
    .filter((i) => i >= 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {isMapperOpen && (
        <ScreenMapper
          prototypeUrl={prototypeUrl}
          onPrototypeUrlChange={setPrototypeUrl}
          testId={testId}
          trackingId={trackingId}
          tasks={tasks}
          activeTaskIndex={activeTaskIndex}
          onActiveTaskIndexChange={setActiveTaskIndex}
          onTasksChange={setTasks}
          screens={screenMap}
          onScreensChange={setScreenMap}
          onClose={() => setIsMapperOpen(false)}
        />
      )}
      {/* Escolha do formato antes de tudo */}
      {!moderation && (
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Como este teste vai acontecer?</h2>
            <p className="text-sm text-slate-500">Isso define se o participante pode pedir ajuda à IA durante as tarefas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'moderated' as const,
                icon: Users,
                tone: 'bg-blue-50 text-blue-600',
                title: 'Moderado',
                desc: 'Um facilitador acompanha a sessão ao vivo e pode orientar o participante.',
                bullets: ['Facilitador assiste e conduz', 'Sem botão de ajuda da IA', 'Ideal para entrevistas e testes exploratórios']
              },
              {
                key: 'unmoderated' as const,
                icon: Bot,
                tone: 'bg-violet-50 text-violet-600',
                title: 'Não moderado',
                desc: 'O participante faz sozinho, no tempo dele, pelo link do teste.',
                bullets: ['Ninguém acompanha ao vivo', 'Botão "Ajuda da IA" nas tarefas', 'Cada pedido de ajuda fica registrado nos resultados']
              }
            ].map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setModeration(o.key)}
                  className="group text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all bg-white space-y-3"
                >
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${o.tone}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="text-base font-semibold text-slate-900">{o.title}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{o.desc}</div>
                  </div>
                  <ul className="space-y-1">
                    {o.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" /> {b}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">Escolher →</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {moderation && (<>
      {/* Step Progress Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Estudo' },
            { step: 2, label: 'Hipóteses' },
            { step: 3, label: 'Tarefas' },
            { step: 4, label: 'Métricas' },
            { step: 5, label: 'Publicar' }
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div
                onClick={() => !createdTestResult && setCurrentStep(item.step as any)}
                className={`flex items-center gap-2.5 cursor-pointer transition-colors ${
                  currentStep === item.step
                    ? 'text-blue-600 font-bold'
                    : currentStep > item.step
                    ? 'text-emerald-700 font-medium'
                    : 'text-slate-600'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === item.step
                      ? 'bg-blue-600 text-white shadow-xs'
                      : currentStep > item.step
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {currentStep > item.step ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : item.step}
                </div>
                <span className="text-xs font-semibold hidden md:inline">{item.label}</span>
              </div>
              {idx < 4 && <div className="h-px bg-slate-200 flex-1 mx-3 hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ETAPA 1 — INFORMAÇÕES */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="px-6 sm:px-8 pt-7 pb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Sobre o estudo</h2>
              <p className="text-sm text-slate-500 mt-0.5">O essencial para gerar o link. O resto é opcional.</p>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${moderation === 'moderated' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
              {moderation === 'moderated' ? <Users className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              {moderation === 'moderated' ? 'Moderado' : 'Não moderado · ajuda da IA'}
              {!createdTestResult && (
                <button type="button" onClick={() => setModeration(null)} className="font-medium underline underline-offset-2 opacity-70 hover:opacity-100">
                  alterar
                </button>
              )}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Protótipo */}
            <section className="px-6 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 md:gap-8">
              <div>
                <div className="text-sm font-semibold text-slate-900">Protótipo</div>
                <p className="text-xs text-slate-500 mt-1">O link que o participante vai navegar (Figma Make ou protótipo publicado).</p>
              </div>
              <div className="space-y-1.5">
                <div className={`flex items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-blue-500/15 ${
                  step1Tried && !prototypeUrl.trim() ? 'border-rose-300' : 'border-slate-200 focus-within:border-blue-500'
                }`}>
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="url"
                    value={prototypeUrl}
                    onChange={(e) => {
                      setPrototypeUrl(e.target.value);
                      setVerificationPassed(null);
                    }}
                    placeholder="https://seu-prototipo.figma.site"
                    className="flex-1 min-w-0 py-2.5 text-sm text-slate-900 font-mono outline-none bg-transparent"
                  />
                  {prototypeUrl.trim() && (
                    <a href={prototypeUrl.trim()} target="_blank" rel="noreferrer noopener" className="text-slate-400 hover:text-blue-600" title="Abrir em nova aba">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {step1Tried && !prototypeUrl.trim() && <p className="text-xs text-rose-600">Cole o link do protótipo para continuar.</p>}
              </div>
            </section>

            {/* Identificação */}
            <section className="px-6 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 md:gap-8">
              <div>
                <div className="text-sm font-semibold text-slate-900">Identificação</div>
                <p className="text-xs text-slate-500 mt-1">Como o teste aparece na lista e o que você quer descobrir.</p>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">Nome do teste</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Simulação de empréstimo com garantia"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 ${
                      step1Tried && !name.trim() ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">Objetivo da pesquisa</span>
                  <textarea
                    rows={2}
                    value={researchGoal}
                    onChange={(e) => setResearchGoal(e.target.value)}
                    placeholder="Ex.: Entender se o corretor consegue simular sem ajuda e onde trava."
                    className={`w-full resize-none px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 ${
                      step1Tried && !researchGoal.trim() ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                </label>
              </div>
            </section>

            {/* Participantes */}
            <section className="px-6 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 md:gap-8">
              <div>
                <div className="text-sm font-semibold text-slate-900">Participantes</div>
                <p className="text-xs text-slate-500 mt-1">Quando completar, o link fecha para novas pessoas.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setParticipantLimit(Math.max(1, participantLimit - 1))} className="w-10 h-10 text-slate-500 hover:bg-slate-50 text-lg" aria-label="Menos">
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={participantLimit}
                    onChange={(e) => setParticipantLimit(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 h-10 text-center text-sm font-semibold text-slate-900 outline-none border-x border-slate-200"
                  />
                  <button type="button" onClick={() => setParticipantLimit(participantLimit + 1)} className="w-10 h-10 text-slate-500 hover:bg-slate-50 text-lg" aria-label="Mais">
                    +
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {[5, 10, 20, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setParticipantLimit(n)}
                      className={`px-3 h-8 rounded-lg text-xs font-semibold ${participantLimit === n ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400 w-full">Cada pessoa recebe um número: 1 de {participantLimit}, 2 de {participantLimit}…</span>
              </div>
            </section>

            {/* Detalhes opcionais (sanfona) */}
            <section className="px-6 sm:px-8 py-4">
              <button
                type="button"
                onClick={() => setShowMoreInfo((o) => !o)}
                className="w-full flex items-center justify-between text-left py-2"
                aria-expanded={showMoreInfo}
              >
                <span>
                  <span className="text-sm font-semibold text-slate-900">Mais detalhes</span>
                  <span className="ml-2 text-xs text-slate-400">opcional · descrição, produto, categoria, pesquisador</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMoreInfo ? 'rotate-180' : ''}`} />
              </button>
              {showMoreInfo && (
                <div className="pt-3 pb-2 space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1">Preencher com um modelo:</span>
                    {[
                      ['saas', 'SaaS B2B'],
                      ['ecom', 'E-commerce'],
                      ['mobile', 'Mobile App'],
                      ['blank', 'Limpar tudo']
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => applyPresetTemplate(k as any)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-600 mb-1.5">Descrição</span>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Contexto, escopo e público do teste"
                      className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">Produto</span>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="Ex.: Cotador Web"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">Categoria</span>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500"
                      >
                        <option value="SaaS / B2B">SaaS / B2B</option>
                        <option value="E-commerce">E-commerce</option>
                        <option value="Mobile App / Fintech">Mobile App / Fintech</option>
                        <option value="Healthtech">Healthtech</option>
                        <option value="Geral / Customizado">Geral / Customizado</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">Pesquisador</span>
                      <input
                        type="text"
                        value={researcherName}
                        onChange={(e) => setResearcherName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="px-6 sm:px-8 py-4 flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setStep1Tried(true);
                if (prototypeUrl.trim() && name.trim() && researchGoal.trim()) setCurrentStep(2);
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Etapa 2 — Hipóteses (opcional) */}
      {currentStep === 2 && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" /> Hipóteses
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              O que o time espera que aconteça (até 3). No resultado, cada uma aparece como confirmada, parcial ou refutada, com os números e o que os participantes disseram.
            </p>
          </div>
          <div className="px-6 sm:px-8 py-6">
            <HypothesesEditor value={hypotheses} onChange={setHypotheses} tasks={tasks} />
          </div>
          <div className="px-6 sm:px-8 py-4 flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
            <button type="button" onClick={() => setCurrentStep(1)} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <div className="flex items-center gap-2">
              {hypotheses.filter((h) => h.statement.trim()).length === 0 && <span className="text-xs text-slate-400">Pode pular e adicionar depois no resultado.</span>}
              <button type="button" onClick={() => setCurrentStep(3)} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                {hypotheses.filter((h) => h.statement.trim()).length ? 'Continuar' : 'Pular por agora'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 2 — TAREFAS & CAMINHO ESPERADO */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Etapa 3 — Tarefas e caminho esperado
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Defina as instruções exibidas ao participante e configure o caminho esperado (<code className="text-blue-600 font-mono">expectedPath[]</code>).
              </p>
            </div>
            <button
              type="button"
              onClick={addTask}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Tarefa</span>
            </button>
          </div>

          {/* Task Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
            {tasks.map((task, idx) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setActiveTaskIndex(idx)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTaskIndex === idx
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>Tarefa {idx + 1}</span>
                {tasks.length > 1 && (
                  <Trash2
                    className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 ml-1 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(idx);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Active Task Form */}
          {tasks[activeTaskIndex] && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Título da tarefa *</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].title}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].title = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Localizar e acionar o CTA principal de criação"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Objetivo da tarefa</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].objective}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].objective = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Avaliar se o participante localiza a ação inicial sem hesitação."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Instrução apresentada ao participante *
                </label>
                <textarea
                  rows={2}
                  value={tasks[activeTaskIndex].instruction}
                  onChange={(e) => {
                    const updated = [...tasks];
                    updated[activeTaskIndex].instruction = e.target.value;
                    setTasks(updated);
                  }}
                  placeholder="Ex: Navegue pelo protótipo, encontre a funcionalidade solicitada e avance até a tela final de confirmação."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                />
              </div>

              {/* Expected Path Visual Builder + Mapeador de cenários */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Caminho Esperado (expectedPath[])
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {tasks[activeTaskIndex].expectedPath.length} cenário(s) • {screenMap.length} cenário(s) mapeado(s) no protótipo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapperOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                  >
                    <ScanSearch className="w-4 h-4" />
                    <span>{screenMap.length ? 'Abrir mapeador de cenários' : 'Mapear cenários do protótipo'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  O Figma Make funciona em uma única página e troca componentes na tela. O mapeador abre o protótipo, detecta cada troca de
                  cenário (título, subtítulo, etapa “1 de 3”, modais) e grava o caminho da tarefa com a ação que levou a cada cenário.
                </p>

                {/* Visual Flow Representation */}
                <div className="flex items-center gap-2 overflow-x-auto py-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white text-slate-600 font-bold text-[10px] uppercase border border-slate-200">
                    INÍCIO
                  </span>
                  <span className="text-blue-500 font-bold">→</span>

                  {getTaskSteps(tasks[activeTaskIndex], screenMap).map((step, sIdx, all) => (
                    <React.Fragment key={`${step.screenId}-${sIdx}`}>
                      <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shrink-0 shadow-xs group">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[11px] max-w-[220px] truncate" title={step.screenId}>
                          {step.screenName}
                        </span>

                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          {sIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => movePathStep(activeTaskIndex, sIdx, 'up')}
                              className="p-0.5 text-slate-400 hover:text-slate-700"
                              title="Mover para esquerda"
                            >
                              <MoveUp className="w-3 h-3 rotate-270" />
                            </button>
                          )}
                          {sIdx < all.length - 1 && (
                            <button
                              type="button"
                              onClick={() => movePathStep(activeTaskIndex, sIdx, 'down')}
                              className="p-0.5 text-slate-400 hover:text-slate-700"
                              title="Mover para direita"
                            >
                              <MoveDown className="w-3 h-3 rotate-270" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removePathStep(activeTaskIndex, sIdx)}
                            className="p-0.5 text-slate-400 hover:text-rose-500"
                            title="Remover etapa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <span className="text-blue-500 font-bold">→</span>
                    </React.Fragment>
                  ))}

                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-200">
                    SUCESSO
                  </span>
                </div>

                {/* Passo a passo detalhado */}
                {getTaskSteps(tasks[activeTaskIndex], screenMap).some((st) => st.trigger || screenMap.some((m) => m.screenId === st.screenId)) && (
                  <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
                    {getTaskSteps(tasks[activeTaskIndex], screenMap).map((st, idx) => {
                      const mapped = screenMap.find((m) => m.screenId === st.screenId);
                      return (
                        <div key={`${st.screenId}-detail-${idx}`} className="flex gap-3 p-2.5">
                          <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          {mapped?.thumbnail && (
                            <img src={mapped.thumbnail} alt="" className="w-20 h-12 rounded-md border border-slate-200 object-cover object-top shrink-0" />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            {st.trigger && idx > 0 && (
                              <div className="text-[11px] text-violet-700 flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> ao clicar em “{st.trigger}”
                              </div>
                            )}
                            <div className="font-semibold text-slate-900">{st.screenName}</div>
                            {mapped && (mapped.stepLabel || mapped.actions.length > 0) && (
                              <div className="text-[11px] text-slate-500 truncate">
                                {mapped.stepLabel ? `Etapa ${mapped.stepLabel} • ` : ''}
                                {mapped.actions.slice(0, 5).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Step input */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <input
                    type="text"
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    list="mapped-screens-list"
                    placeholder="Adicionar cenário manualmente (ex: resumo da proposta)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 outline-none text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                    onKeyDown={(e) => e.key === 'Enter' && addPathStep(activeTaskIndex)}
                  />
                  <datalist id="mapped-screens-list">
                    {screenMap.map((sc) => (
                      <option key={sc.screenId} value={sc.screenId}>
                        {sc.screenName}
                      </option>
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => addPathStep(activeTaskIndex)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
                  >
                    + Adicionar Etapa
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Critério de sucesso</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].successCriteria}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].successCriteria = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Acessar a tela de Dados do Veículo."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1.5">Critério de erro</label>
                  <input
                    type="text"
                    value={tasks[activeTaskIndex].errorCriteria}
                    onChange={(e) => {
                      const updated = [...tasks];
                      updated[activeTaskIndex].errorCriteria = e.target.value;
                      setTasks(updated);
                    }}
                    placeholder="Ex: Acessar produtos não relacionados ou errar cliques."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span>Avançar para Métricas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ETAPA 3 — CONFIGURAÇÃO DE MÉTRICAS */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <MetricsStep
          metrics={metrics}
          setMetrics={setMetrics}
          customQuestions={customQuestions}
          setCustomQuestions={setCustomQuestions}
          tasksCount={tasks.length}
          npsConfig={npsConfig}
          setNpsConfig={setNpsConfig}
          susQuestions={susQuestions}
          setSusQuestions={setSusQuestions}
          onBack={() => setCurrentStep(3)}
          onNext={() => setCurrentStep(5)}
        />
      )}

      {/* ========================================================================= */}
      {/* ETAPA 4 — PUBLICAÇÃO & VALIDAÇÃO TÉCNICA DO PROTÓTIPO */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Etapa 5 — Revisar e publicar</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Confira o resumo do teste e publique para gerar o link dos participantes.
            </p>
          </div>

          {/* Published state callout if already created */}
          {createdTestResult ? (
            <div className="p-6 sm:p-7 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-800 space-y-6 shadow-xs animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Link do Teste de Usabilidade Gerado com Sucesso!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                    Seu teste está ativo. Ao acessar o link abaixo, o participante navegará no protótipo fornecido enquanto a plataforma registra as tarefas, cliques, tempo e avaliação SUS.
                  </p>
                </div>
              </div>

              {/* Share URL Box Prominent */}
              <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Link Oficial do Teste para Participantes:</span>
                  </span>
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md font-mono border border-slate-200">
                    ID: {createdTestResult.id}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareableTestUrl(createdTestResult.id, createdTestResult.prototypeUrl)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-blue-700 text-xs font-mono select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(createdTestResult.id, createdTestResult.prototypeUrl)}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                  >
                    {copiedLink ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link do Teste'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Actions: Run Now vs Open Prototype vs Open Test */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                {/* 2. Executar o fluxo agora dentro da plataforma */}
                <button
                  type="button"
                  onClick={() => onOpenRunner(createdTestResult.id, createdTestResult.prototypeUrl)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-xs text-center"
                  title="Executa o teste com o protótipo carregado diretamente no player de avaliação"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" />
                  <span>Fazer Teste no Protótipo</span>
                </button>

                {/* 3. Abrir o ambiente de teste em nova aba */}
                <a
                  href={getShareableTestUrl(createdTestResult.id, createdTestResult.prototypeUrl)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs text-center"
                  title="Abre a tela de execução do participante em uma nova aba com o protótipo validado"
                >
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Abrir Teste em Nova Aba</span>
                </a>
              </div>

              {/* Forward to Results Dashboard */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-3 border-t border-emerald-200/80">
                <div className="text-xs text-slate-600">Envie o link aos participantes e acompanhe os resultados no painel.</div>
                <button
                  type="button"
                  onClick={() => onSuccess(createdTestResult)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shrink-0"
                >
                  Ir para Painel de Resultados →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumo organizado do que foi configurado (sem a antiga verificação técnica do protótipo) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Teste</div>
                  <div className="text-sm font-semibold text-slate-900">{name || 'Sem nome'}</div>
                  <div className="text-slate-500">
                    {productName || 'Produto não informado'} · {researcherName || 'Pesquisador não informado'}
                  </div>
                  <div className="pt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${moderation === 'moderated' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                      {moderation === 'moderated' ? 'Moderado · sem ajuda da IA' : 'Não moderado · com ajuda da IA'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Participantes</div>
                  <div className="text-sm font-semibold text-slate-900">{participantLimit} previstos</div>
                  <div className="text-slate-500">o link fecha ao completar</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tarefas ({tasks.length})</div>
                  <button type="button" onClick={() => setCurrentStep(3)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    Editar tarefas
                  </button>
                </div>
                <ol className="space-y-2">
                  {tasks.map((t, i) => {
                    const ok = !undetectable.includes(i);
                    const lastId = t.expectedPath[t.expectedPath.length - 1];
                    const endName = screenMap.find((m) => m.screenId === lastId)?.screenName;
                    return (
                      <li key={t.id} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900">{t.title}</div>
                          <div className="text-slate-500">{t.expectedPath.length} tela(s) no caminho esperado</div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                            ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                          title={ok ? 'A tarefa termina sozinha nesta tela' : 'Sem tela final mapeada'}
                        >
                          {ok ? <Check className="w-3 h-3 stroke-[3]" /> : <Info className="w-3 h-3" />}
                          {ok ? `Termina em: ${endName || 'próxima tarefa'}` : 'Sem fim mapeado'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">O que será medido</div>
                  <button type="button" onClick={() => setCurrentStep(4)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    Editar métricas
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: 'Métricas automáticas',
                      value: `${(['taskSuccessRate', 'completionRate', 'abandonmentRate', 'taskDuration', 'screenDuration', 'clickCount', 'idealPath', 'pathDeviation', 'mostUsedPath', 'backReturns', 'clickZoning', 'errorClicks'] as const).filter((k) => metrics[k]).length} de 12`,
                      on: true
                    },
                    {
                      label: 'Perguntas',
                      value: metrics.customQuestions === false ? 'Desligadas' : `${customQuestions.filter((q) => q.question.trim()).length} pergunta(s)`,
                      on: metrics.customQuestions !== false
                    },
                    { label: 'NPS', value: metrics.nps ? `Escala 0 a ${npsConfig.scaleMax}` : 'Desligado', on: metrics.nps },
                    {
                      label: 'SUS',
                      value: metrics.sus ? (metrics.qualitativeComments ? '10 itens + comentário' : '10 itens') : 'Desligado',
                      on: metrics.sus
                    }
                  ].map((c) => (
                    <div key={c.label} className={`p-3 rounded-xl border ${c.on ? 'border-blue-100 bg-blue-50/50' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                      <div className="text-[11px] text-slate-500">{c.label}</div>
                      <div className={`text-sm font-semibold ${c.on ? 'text-slate-900' : 'text-slate-400'}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {hypotheses.filter((h) => h.statement.trim()).length > 0 && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Hipóteses</div>
                    <button type="button" onClick={() => setCurrentStep(2)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                      Editar hipóteses
                    </button>
                  </div>
                  {hypotheses
                    .filter((h) => h.statement.trim())
                    .map((h, i) => (
                      <div key={h.id} className="flex items-start gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">H{i + 1}</span>
                        <span className="text-slate-700">{h.statement}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Tarefas cujo fim o sistema não consegue detectar: bloqueiam a publicação */}
              {undetectable.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                  <div className="font-bold">
                    {undetectable.length === tasks.length ? 'Nenhuma tarefa tem fim mapeado' : `${undetectable.length} tarefa(s) sem fim mapeado`}
                  </div>
                  <p className="leading-relaxed">
                    {undetectable.map((i) => `Tarefa ${i + 1}`).join(', ')}: o sistema precisa saber em qual tela cada tarefa termina para avançar sozinho, sem o participante
                    clicar em nada. Volte à Etapa 3 (Tarefas), use “Mapear cenários do protótipo” e grave o caminho até a última tela.
                  </p>
                  <button type="button" onClick={() => setCurrentStep(3)} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                    Ir para o mapeamento
                  </button>
                </div>
              )}

              {/* Publication Buttons */}
              <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!prototypeUrl.trim() || undetectable.length > 0}
                  title={undetectable.length > 0 ? 'Mapeie o fim de todas as tarefas para publicar' : undefined}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Publicar e Gerar Link do Teste</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
      </>)}
    </div>
  );
};
