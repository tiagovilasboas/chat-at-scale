# 12 — Staff e Principal: o que é, o que diferencia

> Referência do mercado para entender a atuação e o pensamento de Staff e Principal Engineers. Baseado em fontes públicas (Will Larson, LeadDev, DataAnnotation, CTO Executive Insights).

---

## O que é um Staff Engineer de verdade

Staff Engineer é o **primeiro degrau de liderança técnica sem gestão de pessoas** (IC leadership). É o nível acima de Senior na trilha técnica.

Não existe uma definição única. No mercado, Staff cai em um desses perfis (Will Larson, *Staff Engineer*):

| Arquétipo | Foco |
|-----------|------|
| **Tech Lead** | Guia abordagem e execução de um time ou cluster de times; parceiro do manager; define visão técnica; delega projetos complexos para crescer o time |
| **Architect** | Define direção, qualidade e abordagem em uma área crítica; combina conhecimento técnico, necessidades de usuário e liderança no nível da organização |
| **Solver** | Mergulha em problemas arbitrariamente complexos e encontra caminhos; pode focar em uma área ou mover entre hotspots; excelência técnica + comunicação |
| **Right Hand** | Estende a atenção e autoridade de um executivo; dá bandwidth extra a líderes de organizações grandes; converte ineficiências em programas bem executados |

**Em comum:** escopo além do time imediato, impacto multiplicador, decisões de arquitetura que afetam múltiplas pessoas.

---

## O que diferencia Staff dos demais

### Senior vs Staff (a virada principal)

| Aspecto | Senior | Staff |
|---------|--------|-------|
| **Escopo** | Sistema ou serviço dentro de um time | Múltiplos times; direção técnica da organização |
| **Impacto** | Maximiza a própria produção | Multiplica a produção dos outros |
| **Tempo em código** | Maioria da semana: código, PRs, bugs | 20–60% em código; resto em reviews, design spikes, planejamento, coordenação |
| **Decisões** | Código, features, métricas do seu sistema | Padrões, arquitetura, trade-offs que afetam toda a org |
| **Autoridade** | Domínio técnico dentro do time | Consulta direta a diretores/VPs; parceria entre times |
| **Mentoria** | 2–3 pessoas do time | Coaching de tech leads; padrões company-wide |

**Virada mental:** de execução profunda de projeto para pensamento arquitetural em escala.

### E o Junior / Mid?

- **Junior:** executa tarefas com supervisão; foco em aprender e entregar bem definido.
- **Mid:** executa de forma autônoma dentro do escopo do time; começa a questionar e propor melhorias locais.
- **Senior:** dono de sistema/serviço; mentora; toma decisões técnicas que afetam o time.
- **Staff:** impacto além do time; define como muitos vão trabalhar.

---

## O que é um Principal Engineer

Principal é tipicamente o **nível seguinte ao Staff** na trilha IC (Individual Contributor). Em orgs com 50+ engenheiros, costuma ser o IC de maior nível antes de Distinguished/Fellow.

| Aspecto | Staff | Principal |
|---------|-------|-----------|
| **Escopo de impacto** | Domínio, área de produto ou cluster de projetos | Organização inteira; todas as linhas de produto |
| **Boundaries** | Opera dentro de limites definidos por outros | Define os limites dentro dos quais Staff operam |
| **Profundidade vs amplitude** | Profundidade em área específica (datastores, runtimes, reliability) | Amplitude no cenário técnico; define arquitetura cross-cutting |
| **Influência** | Times próximos; fronteiras organizacionais imediatas | Tecido conjuntivo da org; negocia trade-offs entre linhas de produto, orçamentos, parceiros externos |
| **Tipo de decisão** | Implementação: escolha de libs, otimização, desbloqueio de release | Estratégico: construir ou não novo sistema, encerrar DB, migrar cloud; alinhado a objetivos de negócio |
| **Quem influencia** | Pares e times relacionados | Executivos; engenharia + negócio |

**Em resumo:** Staff resolve problemas complexos dentro de um escopo. Principal define o escopo e os padrões que muitos seguem.

---

## Os trade-offs de ser Staff/Principal (time, código, você)

O papel não é só técnico. Você abre mão de coisas e ganha outras. O mindset Staff/Principal sabe disso e escolhe consciente:

| O que você abre mão | O que ganha |
|--------------------|-------------|
| Maioria do tempo em código próprio | Impacto multiplicado: o time inteiro segue o que você define |
| Ser o expert em tudo no seu sistema | Visão ampla: sabe onde cada peça encaixa e onde quebra |
| Resolver sozinho e rápido | Ensinar a resolver: capacita o time, não cria dependência |
| Decisão instantânea | Decisão alinhada: stakeholders no mesmo barco, menos retrabalho |
| Apagar incêndio o dia inteiro | Definir o que importa: prioriza o que vai evitar incêndio amanhã |

**Em resumo:** Você para de maximizar seu output e passa a maximizar o do time. Menos "eu fiz", mais "nós desenhamos e entregamos juntos". E sim, às vezes dá vontade de sentar e codar o dia todo. O trade-off é consciente.

---

## O que um Staff/Principal faz no dia a dia (na prática)

- **Jamais pula para implementação antes de entender o problema:** problema primeiro, invariantes, trade-offs, arquitetura, só então código. Em todo projeto.
- **Pensa em trade-offs antes de código:** alternativas, consequências, reversibilidade
- **Documenta decisões:** ADRs, design docs; "se não está documentado, não existe"
- **Assume falhas:** desenha recuperação antes do happy path
- **Pergunta "e se 10x?":** escala, gargalos, custo
- **Leva casos reais pra reunião:** "a Slack fez X; o Discord migrou Y; o eBay provou que 100ms = +0,5% conversão"
- **Não precisa estar certo:** precisa tornar as opções claras e as consequências explícitas

---

## Referências (mercado)

| Fonte | O que aborda |
|-------|--------------|
| [Staff Engineer — Will Larson](https://staffeng.com/book/) | Livro e site; quatro arquétipos; liderança técnica sem gestão |
| [Staff Eng Guides](https://staffeng.com/guides/staff-archetypes) | Arquétipos Tech Lead, Architect, Solver, Right Hand |
| [LeadDev — Staff, Principal, Distinguished](https://leaddev.com/career-ladders/who-are-staff-principal-and-distinguished-engineers) | Diferenças de escopo e impacto |
| [Staff vs Principal — DataAnnotation](https://www.dataannotation.tech/developers/staff-vs-principal-engineer) | Scope, ownership, influência |
| [Principal Engineer em orgs 50+ — CTO Executive Insights](https://ctoexecutiveinsights.com/blog/principal-engineer-role-at-50-engineer-orgs) | Responsabilidades e escopo |
| [Senior vs Staff — Fellow](https://fellow.ai/blog/engineering-staff-engineer-vs-senior-engineer) | Virada Senior→Staff; tempo em código vs estratégia |

---

## Documentos relacionados

- [00 — Regras Principais](./00-principal-engineering-rules.md): o que um Staff/Principal considera antes de implementar
- [03 — Trade-offs](./03-trade-offs.md): exemplo de decisões com alternativas explícitas
- [11 — Casos de Mensageria](./11-casos-mensageria.md): casos reais para citar em discussões
