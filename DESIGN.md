# DESIGN.md

## Identidade e Público
- Produto: Estoque Lanchonete (Gestão de Estoque), aplicação web para controlar inventário, fornecedores, movimentações de entrada/saída/ajuste e alertas de reposição de uma lanchonete.
- Público: Administradores (gerentes e proprietários que cadastram produtos, categorias, fornecedores e usuários) e operadores (equipe de balcão e cozinha que consulta saldos e registra movimentações diárias).
- Personalidade: Editorial minimalista, técnico, direto e confiável; foco em clareza operacional e leitura rápida de tabelas sem ruído visual nem exageros de marketing.

## Dials
Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

- ENERGY 2 (equilibrado): alto contraste monocromático com títulos serifados editoriais e destaque nítido nos botões de ação principal e no card acionável de itens em alerta.
- RHYTHM 2 (consistente com quebras intencionais): faixa superior de métricas assimétrica (destaque para o card clicável de alertas), tabela principal de inventário com painel lateral de cadastro retrátil, listas complementares e bloco inferior operacional lado a lado.
- MOTION 2 (funcional e estrutural): transições suaves na abertura/fechamento do painel lateral de cadastro (`0.55s`), na troca de tema, no feedback discreto de foco/clique e nos micro-controles estruturais do painel (menu de ações da tabela de produtos, busca expansível na barra de filtros da tabela, toast flutuante e confirmação por pressão contínua na remoção de itens), respeitando `prefers-reduced-motion: reduce` e sem animações decorativas ou loops.

## Paleta
### Tema Claro (Padrão)
- Fundo principal: `#FFFFFF`
- Superfície / cards: `#FFFFFF` (superfície secundária e cabeçalhos `#F4F4F5`, inputs `#FAFAFA`, hover `#EFEFEF`, divisores `#E4E4E7` / `#D4D4D8`, bordas de controles interativos `#8B8B93` e hover `#52525B`)
- Texto principal: `#09090B` (corpo `#27272A`)
- Texto secundário: `#52525B` (apoio e placeholders `#666670`)
- Cor de destaque (accent): `#09090B` nos botões primários e bordas de foco (hover `#27272A`, texto `#FFFFFF`); `#DC2626` reservado exclusivamente a alertas de estoque crítico e ações destrutivas (superfície `#FEF2F2`, texto `#991B1B`, borda `#FEE2E2`, hover destrutivo `#991B1B` com texto `#FFFFFF`).

### Tema Escuro (`[data-theme='escuro']`)
- Fundo principal: `#09090B`
- Superfície / cards: `#111113` (superfície secundária `#18181B`, inputs `#141416`, hover `#27272A`, divisores `#27272A` / `#3F3F46`, bordas de controles interativos `#686873` e hover `#A1A1AA`)
- Texto principal: `#FAFAFA` (corpo `#E4E4E7`)
- Texto secundário: `#A1A1AA` (apoio e placeholders `#A1A1AA`)
- Cor de destaque (accent): `#FAFAFA` nos botões primários e bordas de foco (hover `#E4E4E7`, texto `#09090B`); `#EF4444` reservado exclusivamente a alertas de estoque crítico e ações destrutivas (superfície `#271214`, texto `#FCA5A5`, borda `#451A20`, hover destrutivo `#B91C1C` com texto `#FFFFFF`).

## Tipografia
- Títulos: `Lora` (serifada editorial, peso `500` em `h1`/`h2`/`h3`, `letter-spacing: -0.025em`, tamanhos fluidos com `clamp()`).
- Corpo: `Plus Jakarta Sans` (fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`, pesos `400`, `500`, `600` e `700`; base `16px`, `0.92rem` em tabelas e campos de formulário).
- Código / números (se houver): `Lora` (peso `500`) nos números em destaque dos cards de métrica e `Plus Jakarta Sans` com formatação `pt-BR` (`Intl.NumberFormat` em `BRL` e quantidades) nas tabelas; sem uso decorativo de fontes monoespaçadas.

## Tom do Texto (Copy)
- Idioma: Português (BR)
- Estilo: Frases curtas, diretas e operacionais; verbos concretos nos botões (`Novo cadastro`, `Salvar produto`, `Cadastrar usuário`, `Registrar movimentação`, `Limpar`); mensagens de validação e erro objetivas em Português corretamente acentuado; sem jargões de marketing, sem travessões longos e sem emojis em rótulos.

## O que evitar / Preferências
- Tema padrão: Alternância clara e escura persistida no navegador, com tema **claro** como padrão (`claro` / `escuro`), mantendo contraste WCAG AA e paridade funcional em ambos os modos.
- Referências de sensação (não copiar layout): Clareza editorial de livro-razão (ledger) e ferramentas administrativas monocromáticas com bordas finas (hairline), respiro entre blocos e protagonismo total dos dados de inventário.
- O que evitar: Gradientes coloridos ou neon, brilhos (glows), glassmorphism excessivo, cores decorativas fora da escala neutra Zinc (exceto vermelho semântico para alertas e remoção), sombras pesadas em todos os elementos, estatísticas ou textos fictícios, botões sem ação real e nomes de marcas ou sites de terceiros na interface ou nos commits.
