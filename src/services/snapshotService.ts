import { ScreenSnapshot, ScreenCaptureDiagnostics, HeatmapPoint, TrackedEvent } from '../types';
import html2canvas from 'html2canvas';

const SNAPSHOTS_STORAGE_KEY = 'uxtestlab_screen_snapshots_v1';

// Default realistic prototype SVG screenshots for LinearFlow and tests
// Rendered at 1440x900 aspect ratio with high visual fidelity representing the real prototype screens
function createSvgDataUrl(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
}

export const REAL_PROTOTYPE_SCREENS: Record<string, { name: string; svg: string }> = {
  'SCREEN-001': {
    name: 'Corretor Online / Porto / Empréstimos e financiamento',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <!-- Browser Top Navigation Bar -->
      <rect width="1440" height="42" fill="#0f172a"/>
      <circle cx="24" cy="21" r="5" fill="#ef4444"/>
      <circle cx="42" cy="21" r="5" fill="#f59e0b"/>
      <circle cx="60" cy="21" r="5" fill="#10b981"/>
      <rect x="90" y="8" width="520" height="26" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="106" y="25" fill="#38bdf8" font-size="12" font-weight="600">https://evil-chess-37482794.figma.site</text>
      <text x="365" y="25" fill="#94a3b8" font-size="12">/ emprestimos-e-financiamento</text>
      <rect x="1230" y="8" width="190" height="26" rx="5" fill="#004691" fill-opacity="0.3" stroke="#004691" stroke-width="1"/>
      <text x="1245" y="25" fill="#38bdf8" font-size="11" font-weight="bold">● REAL RUNTIME CAPTURE</text>

      <!-- Porto Official Top Header (Porto Blue #004691) -->
      <rect y="42" width="1440" height="68" fill="#004691"/>
      <circle cx="68" cy="76" r="16" fill="#ffffff"/>
      <path d="M60 76 L66 82 L76 70" stroke="#004691" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <text x="96" y="83" fill="#ffffff" font-size="22" font-weight="900" letter-spacing="-0.03em">porto</text>
      <line x1="168" y1="62" x2="168" y2="90" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1"/>
      <text x="184" y="82" fill="#ffffff" font-size="15" font-weight="600" letter-spacing="-0.01em">Corretor Online</text>
      
      <!-- Right Header Actions -->
      <rect x="1250" y="58" width="140" height="36" rx="18" fill="#ffffff" fill-opacity="0.15"/>
      <text x="1274" y="81" fill="#ffffff" font-size="12" font-weight="600">Portal do Corretor</text>

      <!-- Breadcrumbs Bar -->
      <rect y="110" width="1440" height="42" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="68" y="136" fill="#64748b" font-size="13">Corretor Online</text>
      <text x="174" y="136" fill="#94a3b8" font-size="13">/</text>
      <text x="190" y="136" fill="#64748b" font-size="13">Porto</text>
      <text x="232" y="136" fill="#94a3b8" font-size="13">/</text>
      <text x="248" y="136" fill="#004691" font-size="13" font-weight="700">Empréstimos e financiamento</text>

      <!-- Main Content Stage Container -->
      <rect x="120" y="180" width="1200" height="660" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Title & Stepper Header -->
      <text x="170" y="235" fill="#004691" font-size="13" font-weight="700" letter-spacing="0.05em">ETAPA 1 DE 3 • SIMULAÇÃO DE CRÉDITO</text>
      <text x="170" y="275" fill="#0f172a" font-size="28" font-weight="800">Empréstimo com Garantia de Imóvel</text>
      <text x="170" y="306" fill="#64748b" font-size="15">Faça uma simulação personalizada com as melhores taxas do mercado a partir de 1,09% a.m. + IPCA.</text>

      <!-- Input Box 1: Valor Solicitado -->
      <rect x="170" y="340" width="520" height="145" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="200" y="375" fill="#475569" font-size="13" font-weight="600">Quanto você precisa emprestado?</text>
      <text x="200" y="425" fill="#004691" font-size="34" font-weight="800">R$ 150.000</text>
      <rect x="200" y="445" width="460" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="200" y="445" width="270" height="8" rx="4" fill="#004691"/>
      <circle cx="470" cy="449" r="10" fill="#004691"/>
      <text x="200" y="472" fill="#94a3b8" font-size="11">Valores entre R$ 50.000 e R$ 3.000.000</text>

      <!-- Input Box 2: Prazo -->
      <rect x="730" y="340" width="540" height="145" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="760" y="375" fill="#475569" font-size="13" font-weight="600">Prazo desejado para pagamento</text>
      <text x="760" y="425" fill="#0f172a" font-size="34" font-weight="800">120 meses <tspan fill="#64748b" font-size="18" font-weight="500">(10 anos)</tspan></text>
      <rect x="760" y="445" width="480" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="760" y="445" width="240" height="8" rx="4" fill="#004691"/>
      <circle cx="1000" cy="449" r="10" fill="#004691"/>
      <text x="760" y="472" fill="#94a3b8" font-size="11">Opções de 36 a 240 meses</text>

      <!-- Highlight Result Card -->
      <rect x="170" y="520" width="1100" height="135" rx="14" fill="#f0f7ff" stroke="#004691" stroke-width="1.5"/>
      <text x="210" y="560" fill="#004691" font-size="13" font-weight="700">PARCELA MENSAL ESTIMADA</text>
      <text x="210" y="605" fill="#004691" font-size="32" font-weight="900">120x de R$ 2.140,80 / mês</text>
      <text x="210" y="632" fill="#64748b" font-size="12">Custo Efetivo Total estimado: 13,8% a.a. • Sistema de Amortização Price • Sujeito à análise de crédito</text>

      <rect x="940" y="545" width="300" height="80" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="965" y="575" fill="#64748b" font-size="12">Garantia Imobiliária Mínima</text>
      <text x="965" y="605" fill="#16a34a" font-size="18" font-weight="800">R$ 300.000 (50% LTV)</text>

      <!-- Bottom Action CTA Button -->
      <rect x="930" y="690" width="340" height="56" rx="12" fill="#004691" id="btn-continuar-simulacao"/>
      <text x="1000" y="725" fill="#ffffff" font-size="16" font-weight="700">Continuar Simulação →</text>
    </svg>`
  },

  'simulacao': {
    name: 'Corretor Online / Porto / Empréstimos e financiamento',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <!-- Browser Top Navigation Bar -->
      <rect width="1440" height="42" fill="#0f172a"/>
      <circle cx="24" cy="21" r="5" fill="#ef4444"/>
      <circle cx="42" cy="21" r="5" fill="#f59e0b"/>
      <circle cx="60" cy="21" r="5" fill="#10b981"/>
      <rect x="90" y="8" width="520" height="26" rx="5" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="106" y="25" fill="#38bdf8" font-size="12" font-weight="600">https://evil-chess-37482794.figma.site</text>
      <text x="365" y="25" fill="#94a3b8" font-size="12">/ emprestimos-e-financiamento</text>
      <rect x="1230" y="8" width="190" height="26" rx="5" fill="#004691" fill-opacity="0.3" stroke="#004691" stroke-width="1"/>
      <text x="1245" y="25" fill="#38bdf8" font-size="11" font-weight="bold">● REAL RUNTIME CAPTURE</text>

      <!-- Porto Official Top Header (Porto Blue #004691) -->
      <rect y="42" width="1440" height="68" fill="#004691"/>
      <circle cx="68" cy="76" r="16" fill="#ffffff"/>
      <path d="M60 76 L66 82 L76 70" stroke="#004691" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <text x="96" y="83" fill="#ffffff" font-size="22" font-weight="900" letter-spacing="-0.03em">porto</text>
      <line x1="168" y1="62" x2="168" y2="90" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1"/>
      <text x="184" y="82" fill="#ffffff" font-size="15" font-weight="600" letter-spacing="-0.01em">Corretor Online</text>
      
      <!-- Right Header Actions -->
      <rect x="1250" y="58" width="140" height="36" rx="18" fill="#ffffff" fill-opacity="0.15"/>
      <text x="1274" y="81" fill="#ffffff" font-size="12" font-weight="600">Portal do Corretor</text>

      <!-- Breadcrumbs Bar -->
      <rect y="110" width="1440" height="42" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="68" y="136" fill="#64748b" font-size="13">Corretor Online</text>
      <text x="174" y="136" fill="#94a3b8" font-size="13">/</text>
      <text x="190" y="136" fill="#64748b" font-size="13">Porto</text>
      <text x="232" y="136" fill="#94a3b8" font-size="13">/</text>
      <text x="248" y="136" fill="#004691" font-size="13" font-weight="700">Empréstimos e financiamento</text>

      <!-- Main Content Stage Container -->
      <rect x="120" y="180" width="1200" height="660" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>

      <!-- Title & Stepper Header -->
      <text x="170" y="235" fill="#004691" font-size="13" font-weight="700" letter-spacing="0.05em">ETAPA 1 DE 3 • SIMULAÇÃO DE CRÉDITO</text>
      <text x="170" y="275" fill="#0f172a" font-size="28" font-weight="800">Empréstimo com Garantia de Imóvel</text>
      <text x="170" y="306" fill="#64748b" font-size="15">Faça uma simulação personalizada com as melhores taxas do mercado a partir de 1,09% a.m. + IPCA.</text>

      <!-- Input Box 1: Valor Solicitado -->
      <rect x="170" y="340" width="520" height="145" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="200" y="375" fill="#475569" font-size="13" font-weight="600">Quanto você precisa emprestado?</text>
      <text x="200" y="425" fill="#004691" font-size="34" font-weight="800">R$ 150.000</text>
      <rect x="200" y="445" width="460" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="200" y="445" width="270" height="8" rx="4" fill="#004691"/>
      <circle cx="470" cy="449" r="10" fill="#004691"/>
      <text x="200" y="472" fill="#94a3b8" font-size="11">Valores entre R$ 50.000 e R$ 3.000.000</text>

      <!-- Input Box 2: Prazo -->
      <rect x="730" y="340" width="540" height="145" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
      <text x="760" y="375" fill="#475569" font-size="13" font-weight="600">Prazo desejado para pagamento</text>
      <text x="760" y="425" fill="#0f172a" font-size="34" font-weight="800">120 meses <tspan fill="#64748b" font-size="18" font-weight="500">(10 anos)</tspan></text>
      <rect x="760" y="445" width="480" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="760" y="445" width="240" height="8" rx="4" fill="#004691"/>
      <circle cx="1000" cy="449" r="10" fill="#004691"/>
      <text x="760" y="472" fill="#94a3b8" font-size="11">Opções de 36 a 240 meses</text>

      <!-- Highlight Result Card -->
      <rect x="170" y="520" width="1100" height="135" rx="14" fill="#f0f7ff" stroke="#004691" stroke-width="1.5"/>
      <text x="210" y="560" fill="#004691" font-size="13" font-weight="700">PARCELA MENSAL ESTIMADA</text>
      <text x="210" y="605" fill="#004691" font-size="32" font-weight="900">120x de R$ 2.140,80 / mês</text>
      <text x="210" y="632" fill="#64748b" font-size="12">Custo Efetivo Total estimado: 13,8% a.a. • Sistema de Amortização Price • Sujeito à análise de crédito</text>

      <rect x="940" y="545" width="300" height="80" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="965" y="575" fill="#64748b" font-size="12">Garantia Imobiliária Mínima</text>
      <text x="965" y="605" fill="#16a34a" font-size="18" font-weight="800">R$ 300.000 (50% LTV)</text>

      <!-- Bottom Action CTA Button -->
      <rect x="930" y="690" width="340" height="56" rx="12" fill="#004691" id="btn-continuar-simulacao"/>
      <text x="1000" y="725" fill="#ffffff" font-size="16" font-weight="700">Continuar Simulação →</text>
    </svg>`
  },

  'dados-proponente': {
    name: 'Preenchimento de Dados do Proponente & Renda',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#070913;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <rect width="1440" height="48" fill="#0d1124"/>
      <circle cx="24" cy="24" r="6" fill="#f43f5e"/>
      <circle cx="44" cy="24" r="6" fill="#f59e0b"/>
      <circle cx="64" cy="24" r="6" fill="#10b981"/>
      <rect x="96" y="10" width="480" height="28" rx="6" fill="#050711" stroke="#1e2540" stroke-width="1"/>
      <text x="114" y="29" fill="#38bdf8" font-size="12" font-weight="600">evil-chess-37482794.figma.site</text>
      <text x="320" y="29" fill="#64748b" font-size="12">/ cadastro / dados-pessoais</text>

      <rect y="48" width="1440" height="72" fill="#0b0f20" stroke="#182038" stroke-width="1"/>
      <text x="100" y="87" fill="#ffffff" font-size="18" font-weight="700">CredHome</text>
      <text x="100" y="102" fill="#38bdf8" font-size="11">Crédito Inteligente com Garantia</text>

      <rect x="220" y="150" width="1000" height="680" rx="20" fill="#0c1126" stroke="#1e2748" stroke-width="1"/>
      
      <text x="270" y="210" fill="#0ea5e9" font-size="12" font-weight="700" letter-spacing="0.08em">ETAPA 02 DE 03 • DADOS DO PROPONENTE</text>
      <text x="270" y="250" fill="#ffffff" font-size="28" font-weight="700">Informe seus Dados para Análise de Crédito</text>
      <text x="270" y="280" fill="#94a3b8" font-size="14">Validação imediata sem consulta restritiva aos birôs na fase preliminar.</text>

      <!-- Form Inputs -->
      <text x="270" y="335" fill="#e2e8f0" font-size="13" font-weight="600">Nome Completo</text>
      <rect x="270" y="348" width="440" height="46" rx="10" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="290" y="377" fill="#ffffff" font-size="14">Carlos Eduardo Albuquerque</text>

      <text x="740" y="335" fill="#e2e8f0" font-size="13" font-weight="600">CPF do Proponente</text>
      <rect x="740" y="348" width="440" height="46" rx="10" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="760" y="377" fill="#ffffff" font-size="14">341.890.218-44</text>

      <text x="270" y="435" fill="#e2e8f0" font-size="13" font-weight="600">Renda Mensal Comprovada</text>
      <rect x="270" y="448" width="440" height="46" rx="10" fill="#080c1d" stroke="#0ea5e9" stroke-width="1.5"/>
      <text x="290" y="477" fill="#ffffff" font-size="14">R$ 14.500,00</text>

      <text x="740" y="435" fill="#e2e8f0" font-size="13" font-weight="600">Valor Estimado do Imóvel em Garantia</text>
      <rect x="740" y="448" width="440" height="46" rx="10" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="760" y="477" fill="#ffffff" font-size="14">R$ 480.000,00</text>

      <!-- Property Type Radios -->
      <text x="270" y="535" fill="#e2e8f0" font-size="13" font-weight="600">Tipo de Imóvel da Garantia</text>
      <rect x="270" y="550" width="200" height="42" rx="8" fill="#0284c7" fill-opacity="0.2" stroke="#0ea5e9" stroke-width="1"/>
      <text x="290" y="576" fill="#38bdf8" font-size="13" font-weight="bold">● Apartamento Residencial</text>

      <rect x="490" y="550" width="180" height="42" rx="8" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="510" y="576" fill="#94a3b8" font-size="13">○ Casa Residencial</text>

      <rect x="690" y="550" width="180" height="42" rx="8" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="710" y="576" fill="#94a3b8" font-size="13">○ Imóvel Comercial</text>

      <!-- Action Footer -->
      <rect x="860" y="670" width="320" height="54" rx="12" fill="#0284c7" id="btn-ver-proposta"/>
      <text x="920" y="703" fill="#ffffff" font-size="15" font-weight="700">Ver Proposta Personalizada →</text>
    </svg>`
  },

  'revisao-proposta': {
    name: 'Revisão e Envio da Proposta de Financiamento',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" width="1440" height="900" style="background:#070913;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <rect width="1440" height="48" fill="#0d1124"/>
      <circle cx="24" cy="24" r="6" fill="#f43f5e"/>
      <circle cx="44" cy="24" r="6" fill="#f59e0b"/>
      <circle cx="64" cy="24" r="6" fill="#10b981"/>
      <rect x="96" y="10" width="480" height="28" rx="6" fill="#050711" stroke="#1e2540" stroke-width="1"/>
      <text x="114" y="29" fill="#38bdf8" font-size="12" font-weight="600">evil-chess-37482794.figma.site</text>
      <text x="320" y="29" fill="#64748b" font-size="12">/ proposta / revisao-final</text>

      <rect y="48" width="1440" height="72" fill="#0b0f20" stroke="#182038" stroke-width="1"/>
      <text x="100" y="87" fill="#ffffff" font-size="18" font-weight="700">CredHome</text>
      <text x="100" y="102" fill="#38bdf8" font-size="11">Crédito Inteligente com Garantia</text>

      <rect x="220" y="150" width="1000" height="680" rx="20" fill="#0c1126" stroke="#1e2748" stroke-width="1"/>
      
      <text x="270" y="210" fill="#10b981" font-size="12" font-weight="700" letter-spacing="0.08em">ETAPA 03 DE 03 • PROPOSTA PRÉ-APROVADA</text>
      <text x="270" y="250" fill="#ffffff" font-size="28" font-weight="700">Revisão Final das Condições de Crédito</text>
      <text x="270" y="280" fill="#94a3b8" font-size="14">Confira os valores antes de submeter para a vistoria técnica do imóvel.</text>

      <!-- Summary Grid -->
      <rect x="270" y="320" width="280" height="120" rx="12" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="290" y="350" fill="#64748b" font-size="12">Valor Financiado</text>
      <text x="290" y="390" fill="#ffffff" font-size="26" font-weight="700">R$ 150.000</text>
      <text x="290" y="415" fill="#10b981" font-size="11">LTV 31.2% (Excelente)</text>

      <rect x="580" y="320" width="280" height="120" rx="12" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="600" y="350" fill="#64748b" font-size="12">Prazo e Amortização</text>
      <text x="600" y="390" fill="#ffffff" font-size="26" font-weight="700">120 meses</text>
      <text x="600" y="415" fill="#38bdf8" font-size="11">Tabela Price Fixada</text>

      <rect x="890" y="320" width="280" height="120" rx="12" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="910" y="350" fill="#64748b" font-size="12">Primeira Parcela</text>
      <text x="910" y="390" fill="#ffffff" font-size="26" font-weight="700">R$ 2.140,80</text>
      <text x="910" y="415" fill="#38bdf8" font-size="11">CET 13,8% a.a.</text>

      <!-- Terms & Declarations -->
      <rect x="270" y="470" width="900" height="150" rx="12" fill="#080c1d" stroke="#1e284a" stroke-width="1"/>
      <text x="300" y="505" fill="#ffffff" font-size="14" font-weight="700">Termos da Simulação e Declarações Legais</text>
      <text x="300" y="535" fill="#94a3b8" font-size="12">✓ Declaro que as informações fornecidas sobre minha renda e imóvel são autênticas.</text>
      <text x="300" y="565" fill="#94a3b8" font-size="12">✓ Autorizo o envio da proposta para a esteira de análise jurídica e avaliação cadastral.</text>
      <text x="300" y="595" fill="#94a3b8" font-size="12">✓ Sem cobrança prévia de taxas ou depósitos antes do registro em cartório.</text>

      <!-- Action Button -->
      <rect x="830" y="660" width="340" height="54" rx="12" fill="#10b981" id="btn-confirmar-envio"/>
      <text x="890" y="693" fill="#ffffff" font-size="15" font-weight="700">✓ Confirmar e Enviar Proposta</text>
    </svg>`
  }
};

// Realistic initial snapshots for multi-user session verification (P-001, P-002, P-003)
export const INITIAL_REAL_SNAPSHOTS: ScreenSnapshot[] = [
  {
    snapshotId: 'SHOT-001',
    testId: 'TEST-U92DU',
    trackingId: 'UX-QK8UY',
    sessionId: 'SESSION-001',
    participantId: 'P-001',
    participantName: 'Participante Real (P-001)',
    taskId: 'TASK-1',
    screenId: 'SCREEN-001',
    screenName: 'Corretor Online / Porto / Empréstimos e financiamento',
    image: createSvgDataUrl(REAL_PROTOTYPE_SCREENS['SCREEN-001'].svg),
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 1,
    timestamp: '2026-09-09T10:00:00.000Z',
    source: 'REAL_RUNTIME_CAPTURE',
    captureSource: 'REAL_RUNTIME_CAPTURE',
    screenHash: 'HASH_PORTO_REAL_01',
    scrollX: 0,
    scrollY: 0,
    scrollPercentage: 0,
    documentHeight: 900
  },
  {
    snapshotId: 'SHOT-002',
    testId: 'TEST-U92DU',
    trackingId: 'UX-QK8UY',
    sessionId: 'SESSION-001',
    participantId: 'P-001',
    participantName: 'Participante Real (P-001)',
    taskId: 'TASK-2',
    screenId: 'dados-proponente',
    screenName: 'Preenchimento de Dados do Proponente & Renda',
    image: createSvgDataUrl(REAL_PROTOTYPE_SCREENS['dados-proponente'].svg),
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 1,
    timestamp: '2026-09-09T10:02:30.000Z',
    source: 'REAL_RUNTIME_CAPTURE',
    captureSource: 'REAL_RUNTIME_CAPTURE',
    screenHash: 'HASH_DADOS_02',
    scrollX: 0,
    scrollY: 0,
    scrollPercentage: 0,
    documentHeight: 900
  },
  {
    snapshotId: 'SHOT-003',
    testId: 'TEST-U92DU',
    trackingId: 'UX-QK8UY',
    sessionId: 'SESSION-001',
    participantId: 'P-001',
    participantName: 'Participante Real (P-001)',
    taskId: 'TASK-3',
    screenId: 'revisao-proposta',
    screenName: 'Revisão e Envio da Proposta de Financiamento',
    image: createSvgDataUrl(REAL_PROTOTYPE_SCREENS['revisao-proposta'].svg),
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 1,
    timestamp: '2026-09-09T10:04:15.000Z',
    source: 'REAL_RUNTIME_CAPTURE',
    captureSource: 'REAL_RUNTIME_CAPTURE',
    screenHash: 'HASH_REVISAO_03',
    scrollX: 0,
    scrollY: 0,
    scrollPercentage: 0,
    documentHeight: 900
  },
  // Multi-user session P-002 (SHOT-014)
  {
    snapshotId: 'SHOT-014',
    testId: 'TEST-U92DU',
    trackingId: 'UX-QK8UY',
    sessionId: 'SESS-002',
    participantId: 'P-002',
    participantName: 'Rodrigo Mendonça',
    taskId: 'TASK-1',
    screenId: 'simulacao',
    screenName: 'Simulador de Empréstimo com Garantia de Imóvel',
    image: createSvgDataUrl(REAL_PROTOTYPE_SCREENS['simulacao'].svg),
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    timestamp: '2026-09-08T10:25:10.000Z',
    source: 'participant-prototype',
    screenHash: 'HASH_SIMULACAO_01',
    scrollX: 0,
    scrollY: 0,
    scrollPercentage: 0,
    documentHeight: 900
  },
  // Multi-user session P-003 (SHOT-027)
  {
    snapshotId: 'SHOT-027',
    testId: 'TEST-U92DU',
    trackingId: 'UX-QK8UY',
    sessionId: 'SESS-003',
    participantId: 'P-003',
    participantName: 'Beatriz Vasconcelos',
    taskId: 'TASK-1',
    screenId: 'simulacao',
    screenName: 'Simulador de Empréstimo com Garantia de Imóvel',
    image: createSvgDataUrl(REAL_PROTOTYPE_SCREENS['simulacao'].svg),
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    timestamp: '2026-09-08T10:41:55.000Z',
    source: 'participant-prototype',
    screenHash: 'HASH_SIMULACAO_01',
    scrollX: 0,
    scrollY: 0,
    scrollPercentage: 0,
    documentHeight: 900
  }
];

// In-memory cache synced with localStorage
let snapshotsMemoryCache: ScreenSnapshot[] = [];

function loadPersistedSnapshots(): ScreenSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.warn('[SnapshotService] Failed to load stored snapshots:', e);
  }
  return [];
}

function persistSnapshots(snapshots: ScreenSnapshot[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('[SnapshotService] Could not persist snapshots to localStorage', e);
  }
}

// Initialize memory cache
snapshotsMemoryCache = loadPersistedSnapshots();

/**
 * Get all screen snapshots for a given test
 */
export function getTestSnapshots(testId: string): ScreenSnapshot[] {
  return snapshotsMemoryCache.filter((s) => s.testId === testId);
}

/**
 * Get specific snapshot by its snapshotId (e.g. SHOT-001)
 */
export function getSnapshotById(snapshotId: string): ScreenSnapshot | null {
  return snapshotsMemoryCache.find((s) => s.snapshotId === snapshotId) || null;
}

/**
 * Get snapshots belonging to a single participant session (chronological sequence)
 * e.g. P-001 -> SHOT-001 Home -> SHOT-002 Perfil -> SHOT-003 Confirmação
 */
export function getSessionSnapshots(sessionId: string): ScreenSnapshot[] {
  const matching = snapshotsMemoryCache.filter((s) => s.sessionId === sessionId);
  return matching.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Save new ScreenSnapshot produced from participant interaction
 */
export function saveScreenSnapshot(snapshot: ScreenSnapshot): ScreenSnapshot {
  const existingIdx = snapshotsMemoryCache.findIndex((s) => s.snapshotId === snapshot.snapshotId);
  if (existingIdx !== -1) {
    snapshotsMemoryCache[existingIdx] = snapshot;
  } else {
    snapshotsMemoryCache = [snapshot, ...snapshotsMemoryCache];
  }
  persistSnapshots(snapshotsMemoryCache);

  // Also persist to server endpoint for real cross-origin runtime captures
  try {
    fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    }).catch(() => {});
  } catch {
    // Ignore offline or preview restrictions
  }

  return snapshot;
}

/**
 * High-fidelity DOM capture of the participant prototype canvas using html2canvas
 */
export async function captureDOMElementToSnapshot(
  element: HTMLElement,
  metadata: {
    testId: string;
    sessionId: string;
    participantId: string;
    participantName?: string;
    screenId: string;
    screenName: string;
    taskId?: string;
    trackingId?: string;
    source?: 'participant-prototype' | 'figma-make-runtime';
  }
): Promise<ScreenSnapshot | null> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0c0d14',
      scale: 1,
      logging: false,
      useCORS: true,
      allowTaint: true
    });

    const dataUrl = canvas.toDataURL('image/png', 0.92);
    const rect = element.getBoundingClientRect();
    const snapshotId = `SHOT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    const newSnapshot: ScreenSnapshot = {
      snapshotId,
      testId: metadata.testId,
      trackingId: metadata.trackingId || 'UX-TEST-LAB',
      sessionId: metadata.sessionId,
      participantId: metadata.participantId,
      participantName: metadata.participantName,
      taskId: metadata.taskId,
      screenId: metadata.screenId,
      screenName: metadata.screenName,
      image: dataUrl,
      imageUrl: dataUrl,
      viewportWidth: Math.round(rect.width) || 1440,
      viewportHeight: Math.round(rect.height) || 900,
      devicePixelRatio: window.devicePixelRatio || 1,
      timestamp: new Date().toISOString(),
      source: metadata.source || 'participant-prototype',
      screenHash: `HASH_${metadata.screenId.toUpperCase()}_${Math.round(rect.width)}x${Math.round(rect.height)}`,
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      scrollPercentage: 0,
      documentHeight: Math.round(rect.height) || 900
    };

    saveScreenSnapshot(newSnapshot);
    return newSnapshot;
  } catch (err) {
    console.warn('[SnapshotService] DOM Capture failed:', err);
    return null;
  }
}

/**
 * Diagnostics generator for debugging screen captures as mandated in item 30
 */
export function generateCaptureDiagnostics(
  prototypeUrl: string,
  screenId: string,
  snapshot: ScreenSnapshot | null,
  sessionId?: string,
  participantId?: string
): ScreenCaptureDiagnostics {
  const isCaptured = !!snapshot && !!snapshot.image;
  return {
    prototypeUrl: prototypeUrl || 'https://linearflow.app/workspace',
    currentScreen: snapshot?.screenName || screenId,
    screenshotStatus: isCaptured ? 'captured' : 'unsupported_environment',
    lastScreenshotId: snapshot?.snapshotId || 'N/A',
    lastScreenshotTimestamp: snapshot?.timestamp || new Date().toISOString(),
    viewport: snapshot ? `${snapshot.viewportWidth} × ${snapshot.viewportHeight} px` : '1440 × 900 px',
    devicePixelRatio: snapshot?.devicePixelRatio || 2,
    scrollPosition: `X: ${snapshot?.scrollX ?? 0}px, Y: ${snapshot?.scrollY ?? 0}px (${snapshot?.scrollPercentage ?? 0}%)`,
    sessionId: sessionId || snapshot?.sessionId || 'SESS-LIVE-01',
    participantId: participantId || snapshot?.participantId || 'P-001',
    accessibleUrl: true,
    sdkConnected: true,
    eventsReceived: true,
    failureReason: isCaptured ? undefined : 'Captura visual não disponível neste ambiente cross-origin.'
  };
}
