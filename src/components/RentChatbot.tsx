import { useMemo, useState, type FormEvent } from 'react';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

type RentChatbotProps = {
  userName: string;
  stateName: string;
  hourlyWage: number;
  monthlyIncome: number;
  monthlyRent: number;
  personalMonthlyIncome: number;
  rentShare: number;
  rentPercentage: number;
  personalRentPercentage: number;
  isSafe: boolean;
  targetBurden: number;
  roommates: number;
  sideIncome: number;
  monthlySavingsGoal: number;
  transportMode: string;
  moveInTimeline: string;
  formatCurrency: (value: number) => string;
};

const QUICK_QUESTIONS = [
  'What does rent burden mean?',
  'How can I lower my rent burden?',
  'What should my personalized target rent be?',
  'How does having roommates change my budget?',
  'Where can I find affordable housing?',
  'What should I ask before signing a lease?',
];

const AFFORDABLE_HOUSING_RESOURCES = [
  { name: 'HUD Resource Finder', url: 'https://resources.hud.gov/' },
  { name: '2-1-1 Housing Assistance', url: 'https://www.211.org/' },
  { name: 'Public Housing Authorities Directory', url: 'https://www.hud.gov/program_offices/public_indian_housing/pha/contacts' },
  { name: 'AffordableHousing.com', url: 'https://www.affordablehousing.com/' },
  { name: 'NLIHC Housing Help', url: 'https://nlihc.org/rental-assistance' },
];

export function RentChatbot({
  userName,
  stateName,
  hourlyWage,
  monthlyIncome,
  monthlyRent,
  personalMonthlyIncome,
  rentShare,
  rentPercentage,
  personalRentPercentage,
  isSafe,
  targetBurden,
  roommates,
  sideIncome,
  monthlySavingsGoal,
  transportMode,
  moveInTimeline,
  formatCurrency,
}: RentChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const displayName = userName.trim() || 'there';
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: `Hi ${displayName}! I’m your rent helper. Your current setup in ${stateName} is ${formatCurrency(monthlyRent)} total rent on ${formatCurrency(monthlyIncome)} base income (${rentPercentage}%). I also see your personalized share at ${formatCurrency(rentShare)} (${personalRentPercentage}%). Ask me anything about renting, affordability, and next steps.`,
    },
  ]);

  const scenarioSummary = useMemo(
    () =>
      `Your scenario: ${stateName}, ${hourlyWage.toFixed(2)}/hr wage, ${formatCurrency(monthlyIncome)} base income, ${formatCurrency(sideIncome)} side income, ${roommates} person rent split, ${formatCurrency(rentShare)} personal rent share, and ${personalRentPercentage}% personalized burden vs a ${targetBurden}% target.`,
    [
      stateName,
      hourlyWage,
      monthlyIncome,
      sideIncome,
      roommates,
      rentShare,
      personalRentPercentage,
      targetBurden,
      formatCurrency,
    ],
  );

  const generateResponse = (rawPrompt: string) => {
    const prompt = rawPrompt.toLowerCase();
    const targetRent = personalMonthlyIncome * (targetBurden / 100);

    if (prompt.includes('rent burden') || prompt.includes('30%')) {
      return `${scenarioSummary} Rent burden usually means spending more than 30% of income on rent. You are currently ${
        isSafe ? 'below' : 'above'
      } that line, so ${isSafe ? 'your budget has more flexibility.' : 'you may face pressure on food, savings, and emergencies.'}`;
    }

    if (prompt.includes('target rent') || prompt.includes('personalized') || prompt.includes('goal')) {
      return `${scenarioSummary} Based on your ${targetBurden}% burden target, a practical personal rent-share ceiling is about ${formatCurrency(targetRent)} per month. Your current share is ${formatCurrency(rentShare)}. Adjust roommates, hours, or side income to stay under your target consistently.`;
    }

    if (prompt.includes('roommate') || prompt.includes('roommates') || prompt.includes('split')) {
      return `${scenarioSummary} With ${roommates} people sharing rent, your current monthly share is ${formatCurrency(rentShare)} instead of the full ${formatCurrency(monthlyRent)}. Roommates can significantly lower burden, but screen for reliability, payment habits, and shared expectations before signing together.`;
    }

    if (prompt.includes('lower') || prompt.includes('reduce') || prompt.includes('save')) {
      return `${scenarioSummary} Ways to lower burden: 1) keep rent share below ${formatCurrency(targetRent)}, 2) use ${transportMode} strategy to control commute costs, 3) increase side income above ${formatCurrency(sideIncome)} if possible, and 4) auto-save ${formatCurrency(monthlySavingsGoal)} monthly so housing shocks do not break your budget.`;
    }

    if (prompt.includes('affordable housing') || prompt.includes('where') || prompt.includes('find')) {
      const links = AFFORDABLE_HOUSING_RESOURCES.map((resource) => `${resource.name}: ${resource.url}`).join(' | ');
      return `Start here for affordable housing leads and assistance: ${links}. Also search local housing authorities and nonprofit housing counseling agencies in ${stateName}.`;
    }

    if (prompt.includes('lease') || prompt.includes('signing') || prompt.includes('before')) {
      return 'Before signing: confirm total move-in cost, ask about rent increases, verify utilities/fees, understand maintenance response timelines, and review early termination/subletting rules.';
    }

    if (prompt.includes('timeline') || prompt.includes('move')) {
      return `${scenarioSummary} With a move timeline of ${moveInTimeline}, focus first on deposit planning, credit/background readiness, and shortlisting neighborhoods near your daily destinations.`;
    }

    return `${scenarioSummary} I can help with rent burden, roommate strategies, lease questions, timeline prep, and where to find affordable housing programs. Try asking “What should my personalized target rent be?”`;
  };

  const submitPrompt = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const assistantMessage: ChatMessage = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      text: generateResponse(trimmed),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt(input);
  };

  return (
    <div className="chatbot-shell" aria-live="polite">
      {isOpen ? (
        <section className="chatbot-panel" aria-label="Rent helper chatbot">
          <div className="chatbot-header">
            <div>
              <p className="chatbot-title">Rent Helper</p>
              <p className="chatbot-subtitle">Personalized to your calculator scenario</p>
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)} type="button" aria-label="Close chatbot">
              ×
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chatbot-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}>
                {message.text}
              </div>
            ))}
          </div>

          <div className="chatbot-quick-prompts">
            {QUICK_QUESTIONS.map((question) => (
              <button key={question} type="button" className="chatbot-prompt" onClick={() => submitPrompt(question)}>
                {question}
              </button>
            ))}
          </div>

          <form className="chatbot-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about rent burden, leases, or affordable housing"
              aria-label="Chat input"
            />
            <button type="submit">Send</button>
          </form>
        </section>
      ) : null}

      <button className="chatbot-toggle" type="button" onClick={() => setIsOpen((current) => !current)}>
        Chat About Rent
      </button>
    </div>
  );
}
