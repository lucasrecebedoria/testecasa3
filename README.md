# MoveBuss — Relatório de Diferenças

## Pré-requisitos
- Habilite **Authentication → Email/Password** no Firebase Console
- Em **Authentication → Configurações → Domínios autorizados**, adicione `movebuss.local`
- Crie o **Firestore** (modo de teste) e **Storage**
- Publique as regras incluídas neste pacote

## Deploy rápido (Firebase Hosting)
```bash
npm i -g firebase-tools
firebase login
firebase init # escolha Hosting, Firestore, Storage | pasta 'public'
firebase deploy
```

## Sobre as coleções
- **usuarios (doc id = auth.uid)**: `{ matricula, nome, isAdmin }`
- **relatorios**: `{ data, criadoEm, timestamp, matricula, valorFolha, valorDinheiro, sobraFalta, observacao, posTexto, posImgUrl, posEditado }`

## Regras
- Admin (isAdmin:true) cria/edita/exclui/visualiza todos.
- Usuário comum apenas lê relatórios com sua própria matrícula.
