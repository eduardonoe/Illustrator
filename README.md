# Illustrator

Repositorio de scripts, paineis e extensoes para Adobe Illustrator.

## Projetos

### Artboard Resizer (CEP) - v2.7.0

Painel CEP que redimensiona pranchetas e todo o artwork contido nelas, gerando
sempre um arquivo novo e preservando o original.

Principais capacidades:

- Redimensiona todas as pranchetas, apenas a ativa, ou um intervalo.
- Reconstroi o documento em um arquivo novo, mantendo camadas e ordem.
- Divide automaticamente em varios arquivos quando as pranchetas nao cabem em
  um unico canvas regular do Illustrator.
- Expande envelopes (Envelope Distort) antes de escalar, porque a malha do
  envelope nao sobrevive ao salvamento de outra forma.
- Grava um `_debug.txt` ao lado de cada arquivo gerado com o que aconteceu com
  cada item.

## Regra principal

Antes de alterar qualquer painel, script ou arquivo de empacotamento, leia:

1. `VERSIONING.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Esses arquivos definem o padrao compartilhado entre Codex, Claude Code e
qualquer outro agente que trabalhe neste repositorio.

## Fluxo recomendado

1. Entender qual painel ou script sera alterado.
2. Conferir a versao atual no `manifest.json`/`manifest.xml` e no cabecalho do
   script.
3. Implementar a mudanca no menor escopo possivel.
4. Atualizar a versao quando a mudanca alterar comportamento, empacotamento ou
   estabilidade.
5. Fazer commit com mensagem clara em portugues.
6. Subir para o GitHub.

## Cuidados especificos de CEP/Illustrator

- Nao confundir CEP (Illustrator/After Effects) com UXP (Photoshop/Premiere).
- O host roda ExtendScript (ES3): sem `let`, `const`, arrow function ou
  `JSON`.
- `app.executeMenuCommand` com um id invalido **nao lanca erro**, apenas nao
  faz nada. Sempre verificar o efeito do comando em vez de assumir sucesso.
- Medir o resultado **depois de salvar**. Varias construcoes do Illustrator
  (envelopes, efeitos ao vivo) aparecem corretas em memoria e revertem no
  `saveAs`.
- Nunca modificar o documento de origem: trabalhar sempre sobre a copia.
- Nao commitar arquivos de cliente (`.ai`, imagens, links) neste repositorio.
