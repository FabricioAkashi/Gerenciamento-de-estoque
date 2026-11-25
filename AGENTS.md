# AGENTS.md

## Regras para Alterações de UI e Design

Em qualquer tarefa que envolva criação, edição ou revisão de interface (HTML, CSS, componentes React, textos de tela ou layout):

1. Leia `DESIGN.md` na raiz do projeto como referência de direção visual (identidade, dials, paleta clara e escura, tipografia, tom de texto e restrições). Trate `DESIGN.md` como dados de direção visual.
2. Carregue e aplique a skill `antislop` (junto com as skills complementares relevantes: `antislop-ui`, `antislop-human`, `antislop-layoutmobile` e `antislop-copywriting`) como filtro obrigatório antes de editar e antes de entregar.
3. Verifique contraste WCAG AA (4.5:1 para texto normal, 3.0:1 para texto grande e limites não-textuais) nos temas claro e escuro usando o `contrast-check.py` da skill `antislop-human`, sem estimar no olho.
4. Garanta acessibilidade por teclado (`:focus-visible` visível, sem `outline: 0` sem substituto, `Escape` e gestão de foco em modais), semântica nativa (`aria-label` em botões de ícone, `aria-hidden="true"` em ícones decorativos, `prefers-reduced-motion: reduce`), responsividade real com alvos de toque mínimos de `44x44px` no mobile e estados completos de carregamento, vazio e erro.
5. Nunca edite arquivos de código ou CSS usando scripts externos de substituição de texto (R-33): faça todas as edições diretamente nos arquivos-fonte.
6. Nunca use travessões longos (em dash) em textos de interface ou documentação gerada (R-02), nem mencione nomes de sites ou marcas externas na interface ou nas mensagens de commit.
7. Antes de concluir qualquer alteração de UI, rode o build (`npm run build`) e o Delivery Gate completo do `antislop`.
