# Relatório de Diferenças — Site (Firebase)

Este projeto é um site pronto para subir no GitHub (ou qualquer hospedagem estática) que usa **Firebase** para autenticação, banco de dados (Firestore) e armazenamento de imagens (Storage).

## Como funciona a autenticação por matrícula/senha
- O usuário digita **matrícula** e **senha** (não e-mail).
- Internamente o app converte a matrícula em um e-mail sintético no formato `MATRICULA@matriculas.local` apenas para usar o Firebase Auth.
- No **cadastro**, além de criar o usuário, é salvo um documento na coleção **`usuarios`** com os campos: `uid, matricula, nome, role`.
- As matrículas `6266`, `4144` e `70029` já entram automaticamente como **admins**.

## Como criar a coleção para salvar os relatórios
- Os relatórios são salvos na coleção **`relatorios`**.
- Cada documento possui:  
  ```json
  {
    "dataCaixa": Timestamp,
    "valorFolha": number,
    "valorDinheiro": number,
    "sobraFalta": number,
    "observacao": string,
    "matricula": string,
    "posConferenciaEdited": boolean,
    "createdAt": Timestamp,
    "updatedAt": Timestamp,
    "createdBy": string
  }
  ```
- Ao abrir o botão **"pós conferência"** é criado/atualizado um subdocumento em `relatorios/{id}/posConferencia/dados` com:  
  ```json
  {
    "texto": string,
    "imageUrl": string|null,
    "editedAt": Timestamp,
    "editedBy": string
  }
  ```
- As imagens são enviadas para o **Firebase Storage** em `pos_conferencia/{reportId}/{nomeDoArquivo}` e o link público fica salvo em `imageUrl`.

> **Dica:** Você não precisa criar coleções manualmente; elas nascem no primeiro `setDoc/addDoc` feito pelo site.

## Regras de segurança recomendadas (Firestore)
Copie para **Rules** do Firestore e ajuste se necessário. Elas garantem que:
- Usuário comum só lê seus próprios relatórios e não consegue escrever.
- Admin (marcado em `usuarios/{matricula}.role == 'admin'`) tem permissão total.
```
// Com base em autenticação por e-mail sintético "matricula@matriculas.local"
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function userMatricula() {
      return request.auth != null ? split(request.auth.token.email, '@')[0] : null;
    }

    match /usuarios/{matricula} {
      allow read: if request.auth != null;
      allow write: if false; // somente via app admins; ajuste se quiser permitir auto-atualização de perfil
    }

    match /relatorios/{id} {
      allow read: if request.auth != null && (
        resource.data.matricula == userMatricula() ||
        get(/databases/$(database)/documents/usuarios/$(userMatricula())).data.role == "admin"
      );
      allow create, update, delete: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(userMatricula())).data.role == "admin";
    }

    match /relatorios/{id}/posConferencia/{docId} {
      allow read: if request.auth != null && (
        get(/databases/$(database)/documents/relatorios/$(id)).data.matricula == userMatricula() ||
        get(/databases/$(database)/documents/usuarios/$(userMatricula())).data.role == "admin"
      );
      allow create, update, delete: if request.auth != null &&
        get(/databases/$(database)/documents/usuarios/$(userMatricula())).data.role == "admin";
    }
  }
}
```

## Regras de segurança recomendadas (Storage)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function userMatricula() {
      return request.auth != null ? split(request.auth.token.email, '@')[0] : null;
    }

    // imagens de pós conferencia
    match /pos_conferencia/{reportId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/(default)/documents/usuarios/$(userMatricula())).data.role == "admin";
      allow delete: if request.auth != null &&
        get(/databases/(default)/documents/usuarios/$(userMatricula())).data.role == "admin";
    }
  }
}
```

## Fluxo de uso (o que foi implementado)
- **Login/Logout** no topo direito; badge com nome/matrícula/role.
- **Cadastro** cria usuário e documento em `usuarios`.
- **Usuário comum**:
  - Após login, vê **somente** os seus relatórios.
  - **Exibidos os 15 mais recentes** expandidos. Antigos ficam minimizados (a lista completa aparece, mas só os 15 mais novos vêm abertos).
  - Pode abrir o **"pós conferência"** para **visualizar imagem** e **fechar** (sem editar).
- **Administrador**:
  - Possui formulário para **criar/editar/excluir** relatórios.
  - Filtra por **matrícula** e vê os **20** mais recentes expandidos.
  - Botão **"Resumo do Recebedor"** (por mês) com total de folhas, somatório de sobras e de faltas e listas por dia.
  - Pode escrever no **pós conferência**, anexar e excluir imagens. Ao salvar, o relatório recebe o selo **"verificar pós conferência"** em amarelo.

## Personalização
- Substitua `assets/logo.png` pela sua logo. O site já mostra no canto superior esquerdo.
- Cores: tema preto/cinza com textura fibra de carbono, detalhes verde-bandeira e botões metálicos.
- Os campos têm fundo cinza muito claro, bordas verde-bandeira e texto preto, conforme solicitado.

## Deploy rápido (GitHub Pages)
1. Crie um repositório no GitHub.
2. Envie todos os arquivos desta pasta.
3. Ative **Settings → Pages → Deploy from branch** na branch principal.
4. Abra a URL do GitHub Pages para usar.

## Observações
- O cálculo **Sobra/Falta** é automático: *valor em dinheiro – valor folha*.
- Datas exibidas no padrão **brasileiro**.
- Valores formatados como **R$** (BRL).
- Toda a lógica é no front-end; para segurança efetiva, publique as **Rules** acima no Firebase.
