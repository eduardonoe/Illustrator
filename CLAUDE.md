# Claude Code Instructions

Estas instrucoes alinham o trabalho do Claude Code com o fluxo usado tambem
pelo Codex neste repositorio.

## Leitura obrigatoria

Antes de alterar qualquer projeto Illustrator, leia:

1. `README.md`
2. `VERSIONING.md`
3. Este arquivo

## Contexto do repositorio

Este repositorio deve ser usado para projetos Illustrator, especialmente
paineis CEP.

Nao misturar com outros apps:

- After Effects -> repositorio `Scripts-AE`
- Photoshop -> repositorio `Photoshop`
- Premiere -> repositorio `Premiere`

## Regra de versionamento

Versionamento semantico simples, `MAJOR.MINOR.PATCH`, mantido em sintonia
entre `CSXS/manifest.xml` e `var VERSION` no host. Detalhes em
`VERSIONING.md`.

## Fluxo de trabalho

1. Identificar o painel ou script afetado.
2. Ler `manifest.xml` e o host (`ArtboardResizer.jsx`).
3. Fazer a menor alteracao necessaria.
4. Espelhar `PC/` em `MAC/`.
5. Atualizar a versao quando a mudanca afetar comportamento ou empacotamento.
6. Reinstalar e validar antes de considerar pronto.
7. Fazer commit com mensagem clara em portugues.
8. Subir para o GitHub.

## Instalacao

O painel instala copiando `PC/Artboard_Resizer` para:

```text
%APPDATA%\Adobe\CEP\extensions\com.eduardonoe.artboardresizer
```

O instalador tambem liga `PlayerDebugMode` em `HKCU:\Software\Adobe\CSXS.9..13`.

Procedimento: **ao ajustar algo, ja instalar** - nao deixar para o usuario.

## Validacao

Nao declarar correcao sem evidencia. Illustrator pode ser dirigido via COM no
Windows:

```powershell
$ai = [Runtime.InteropServices.Marshal]::GetActiveObject("Illustrator.Application")
$ai.DoJavaScript($codigo)
```

Com isso da para rodar o script de producao num intervalo pequeno, reabrir o
arquivo gerado e medir o resultado, sem consumir rodadas de teste do usuario.

**Medir sempre depois do `saveAs`.** Envelopes e efeitos ao vivo podem estar
certos em memoria e reverter no arquivo salvo - foi exatamente essa a causa do
bug que levou muitas iteracoes para ser encontrado.

## Armadilhas ja pagas (nao repetir)

- `app.executeMenuCommand` com id invalido nao lanca erro: verificar o efeito.
- `expandStyle` (Expand Appearance) **nao** expande Envelope Distort com malha;
  `Expand3` (Object > Expand) expande.
- `duplicate()` entre documentos desloca o item.
- Matriz em coordenadas absolutas nao funciona com `Transformation.TOPLEFT`:
  a ancora reinterpreta a matriz e destroi a translacao.
- `concatenateScaleMatrix` recebe **porcentagem** (100 = tamanho original).
- `item.resize(100, 100, ...)` com escala geometrica neutra e no-op: nao serve
  para reescalar apenas efeitos.
- Aplicar `transform()` direto em `PlacedItem`/`RasterItem` corrompe o preview
  da imagem.

## Cuidados gerais

- Nao misturar projetos diferentes no mesmo commit.
- Nao reformatar arquivo inteiro sem pedido explicito.
- Nao remover historico de changelog existente.
- Nunca commitar arquivos de cliente (`.ai`, links, imagens de campanha).
