# Versioning

Este repositorio usa um padrao simples baseado em SemVer:

```text
MAJOR.MINOR.PATCH
```

Exemplo:

```text
2.7.0
```

## Como incrementar

- `PATCH` (`2.7.0` -> `2.7.1`): correcao de bug, ajuste pequeno,
  compatibilidade, texto, comentario, empacotamento ou melhoria interna.
- `MINOR` (`2.7.0` -> `2.8.0`): novo recurso compativel com o fluxo anterior.
- `MAJOR` (`2.7.0` -> `3.0.0`): mudanca grande, incompatibilidade ou alteracao
  importante no fluxo de uso.

## Onde atualizar

Para paineis CEP, a versao precisa ficar em sintonia em tres lugares:

```text
PC/Artboard_Resizer/CSXS/manifest.xml     -> ExtensionBundleVersion e Extension Version
PC/Artboard_Resizer/host/ArtboardResizer.jsx -> var VERSION
MAC/... (espelho exato do PC)
```

O rodape do painel le a versao do host via `getDocumentInfo`, entao basta
atualizar `var VERSION` para que a interface mostre o valor novo. Isso serve
como confirmacao visual de que a build instalada e a esperada.

## PC e MAC

As pastas `PC/` e `MAC/` devem ser identicas em `host/`, `js/`, `css/`,
`index.html` e `CSXS/`. Apenas os instaladores diferem (`.bat` vs `.command`).

Depois de qualquer alteracao:

```bash
cp PC/Artboard_Resizer/host/ArtboardResizer.jsx MAC/Artboard_Resizer/host/ArtboardResizer.jsx
```

## Changelog

Quando a mudanca for relevante, registre um changelog curto no `README.md`
ou no cabecalho do arquivo principal:

```text
v2.7.0 changelog:
- Expande envelopes antes de escalar (Object > Expand), unica forma de a malha
  sobreviver ao saveAs.
- Divide a saida em varios arquivos quando nao cabe em um canvas regular.
```

## Commits

Use mensagens objetivas em portugues, preferencialmente neste estilo:

```text
fix: corrige envelope que revertia de tamanho ao salvar
feat: divide saida em varios arquivos quando excede o canvas
chore: organiza estrutura do painel
release: prepara Artboard Resizer v2.7.0
```

Quando a mudanca representar uma versao pronta para teste ou uso, incluir a
versao na mensagem do commit.
