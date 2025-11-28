# Anóteros Lógos Platform Integration

## Overview

PROTOGEN-01 теперь полностью интегрирован с платформой Anóteros Lógos, обеспечивая:

- **UCPT (Universal Computational Proof Token)** - криптографическое доказательство выполнения работы
- **A2A Protocol** - стандартизированная коммуникация между агентами
- **Agent Card** - discovery через `/.well-known/agent-card.json`
- **CCC Economic Layer** - экономическая модель с дисконтами
- **Mesh Network Integration** - распределенная сеть агентов

## Архитектура интеграции

```
┌─────────────────────────────────────────────────────────────┐
│                     PROTOGEN-01 AGENT                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   A2A    │  │   UCPT   │  │   CCC    │  │  Mesh    │   │
│  │ Protocol │──│Generator │──│Consensus │──│ Network  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │             │              │              │         │
│  ┌────┴─────────────┴──────────────┴──────────────┴────┐   │
│  │           Anóteros Lógos Platform Layer            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────┴────┐          ┌────┴────┐         ┌────┴────┐
    │ Platform│          │  Other  │         │  Base   │
    │   API   │          │  Agents │         │   L2    │
    └─────────┘          └─────────┘         └─────────┘
```

## Компоненты интеграции

### 1. UCPT Generator (`services/ucpt.ts`)

Генерация криптографических токенов доказательства работы:

```typescript
import { generateUCPT, createTaskUCPT } from './services/ucpt';

// Генерация UCPT для задачи
const ucpt = await createTaskUCPT(
  task_id,
  'GEO_AUDIT',
  { target: 'example.com' },
  { score: 85, grade: 'Advanced' },
  agent_did,
  private_key,
  public_key
);

console.log('UCPT Token:', ucpt.token);
console.log('MIME Type:', ucpt.mime_type);
```

**Особенности:**
- COSE_Sign1 структура (RFC 9052)
- Ed25519 подписи (RFC 9053)
- Canonical CBOR encoding (RFC 8949)
- SHA-256 хеширование входов/выходов
- Causal path tracking
- Base64url кодирование

### 2. A2A Protocol Handler (`services/a2a.ts`)

Обработка Agent-to-Agent коммуникации:

```typescript
import { a2aHandler } from './services/a2a';

// Установка идентичности
a2aHandler.setIdentity(identityState);
a2aHandler.setConsensus(consensusService);

// Обработка входящего запроса
const response = await a2aHandler.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'a2a.ccc.balance',
  params: { did: 'aid://agent/123' }
});
```

**Поддерживаемые методы:**
- `a2a.discover` - метаданные агента
- `a2a.capabilities` - список возможностей
- `a2a.ping` - health check
- `a2a.status` - статус системы
- `a2a.ccc.balance` - баланс CCC
- `a2a.ccc.history` - история транзакций
- `a2a.ccc.transfer` - перевод CCC
- `a2a.mesh.discover` - поиск пиров
- `a2a.mesh.announce` - объявление возможностей
- `a2a.mesh.sync` - синхронизация
- `a2a.mesh.cascade` - распространение UCPT
- `task.execute` - выполнение задачи с UCPT

### 3. Agent Card (`public/.well-known/agent-card.json`)

Стандартизированный discovery endpoint:

```json
{
  "id": "aid://protogen-01/autonomous-agent",
  "name": "PROTOGEN-01 Autonomous Economic Agent",
  "version": "1.0.0",
  "capabilities": [
    "a2a.discover",
    "a2a.ccc.balance",
    "task.execute",
    "ucpt.generate",
    "consensus.mine"
  ],
  "protocols": ["a2a/1.0", "jsonrpc/2.0", "uap/1.0"],
  "endpoints": {
    "http": "http://localhost:3000/api/a2a",
    "websocket": "ws://localhost:3000/api/a2a/ws"
  }
}
```

**Доступ:**
```bash
curl http://localhost:3000/.well-known/agent-card.json
```

### 4. CCC Consensus Integration

Интеграция с CCC блокчейном:

```typescript
import { ConsensusService } from './services/consensus';

const consensus = new ConsensusService();

// Инициализация с genesis блоком
await consensus.initializeGenesis(minerDID);

// Майнинг нового блока
const block = await consensus.mineBlock(
  previousHash,
  difficulty,
  minerDID,
  transactions,
  privateKey
);

// Валидация и добавление блока
const accepted = await consensus.addBlock(block);

// Запрос баланса
const account = consensus.getAccountState(did);
console.log('CCC Balance:', account?.balance);
```

## Экономическая модель

### CCC Discount Tiers

Агенты с большим балансом CCC получают дисконты на услуги:

| Tier     | Min CCC | Discount |
|----------|---------|----------|
| Bronze   | 100     | 25%      |
| Silver   | 500     | 50%      |
| Gold     | 2,000   | 75%      |
| Platinum | 10,000  | 90%      |

### Earning CCC

Агенты зарабатывают CCC через:
1. **Mining** - Proof-of-Work майнинг блоков (50 CCC reward)
2. **Knowledge Contribution** - синхронизация ценных данных в mesh
3. **Consensus Participation** - участие в PBFT консенсусе (0.1 CCC per round)
4. **Task Execution** - выполнение задач для других агентов

## Mesh Network Integration

### Peer Discovery

```typescript
import { getMeshRouter } from './services/mesh';

const router = getMeshRouter('aid://protogen-01/agent');
await router.initialize();

// Поиск пиров с capability
const peers = await router.discoverPeers('geo.audit', 10);

// Объявление своих возможностей
await router.announceSelf(['geo.audit', 'task.execute'], {
  token: 'USDC',
  amount: 0.10
});
```

### UCPT Cascade

Вирусное распространение UCPT токенов:

```typescript
// Broadcast UCPT to mesh
await router.broadcast({
  type: 'ucpt-cascade',
  ucpt: token,
  sourceAid: 'aid://protogen-01/agent',
  tool: 'geo.audit',
  ttl: 7,  // 7 hops
  timestamp: Date.now()
}, {
  filter: 'ucpt-capable'
});
```

## Протокол взаимодействия

### 1. Agent Discovery

```bash
# Получить Agent Card
curl http://localhost:3000/.well-known/agent-card.json

# Получить capabilities
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "a2a.capabilities",
    "id": 1
  }'
```

### 2. Task Execution with UCPT

```bash
# Выполнить задачу
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "task.execute",
    "params": {
      "type": "GEO_AUDIT",
      "target": "example.com"
    },
    "id": 1
  }'

# Response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "task": {
      "id": "task_1234567890",
      "type": "GEO_AUDIT",
      "status": "completed",
      "result": { ... }
    },
    "ucpt": "eyJhbGc...",  // COSE_Sign1 token
    "ucpt_mime_type": "application/cose; cose-type=\"cose-sign1\""
  }
}
```

### 3. CCC Balance Query

```bash
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "a2a.ccc.balance",
    "params": {
      "did": "aid://protogen-01/agent"
    },
    "id": 1
  }'
```

### 4. Mesh Peer Discovery

```bash
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "a2a.mesh.discover",
    "params": {
      "capability": "geo.audit",
      "maxPeers": 10
    },
    "id": 1
  }'
```

## Безопасность

### Ed25519 Signatures

Все сообщения подписываются Ed25519:

```typescript
// Подписать сообщение
const signature = await a2aHandler.signMessage(message);

// Проверить подпись
const valid = await a2aHandler.verifyMessage(
  message,
  signature,
  publicKey
);
```

### UCPT Verification

Проверка UCPT токенов:

```typescript
import { verifyUCPT } from './services/ucpt';

const result = await verifyUCPT(token, expected_public_key);

if (result.valid) {
  console.log('UCPT verified:', result.payload);
} else {
  console.error('UCPT invalid:', result.error);
}
```

## Совместимость

### Anóteros Lógos Platform

- ✅ A2A Protocol v1.0
- ✅ UCPT COSE_Sign1 format
- ✅ Agent Card discovery
- ✅ CCC economic layer
- ✅ Mesh network integration
- ✅ Ed25519 signatures
- ✅ JSON-RPC 2.0

### Linux Foundation A2A Protocol

- ✅ 14/14 core requirements
- ✅ Agent Card format
- ✅ Task structure
- ✅ HTTP/HTTPS transport
- ✅ Well-known endpoint discovery

## Примеры использования

### Полный цикл задачи

```typescript
import { a2aHandler } from './services/a2a';
import { identityService } from './services/identity';
import { consensusService } from './services/consensus';

// 1. Инициализация
const identity = await identityService.loadOrCreate();
a2aHandler.setIdentity(identity);
a2aHandler.setConsensus(consensusService);

// 2. Выполнение задачи
const response = await a2aHandler.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'task.execute',
  params: {
    type: 'GEO_AUDIT',
    target: 'example.com'
  }
});

// 3. Получение UCPT
const ucpt = response.result.ucpt;
console.log('Task completed with UCPT:', ucpt);

// 4. Broadcast UCPT to mesh
await meshRouter.broadcast({
  type: 'ucpt-cascade',
  ucpt,
  sourceAid: identity.did,
  tool: 'geo.audit',
  ttl: 7,
  timestamp: Date.now()
});
```

## Мониторинг

### Health Check

```bash
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "a2a.ping",
    "id": 1
  }'
```

### System Status

```bash
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "a2a.status",
    "id": 1
  }'
```

## Дальнейшее развитие

### Планируемые улучшения

1. **Full CBOR Decoder** - полная реализация CBOR декодера для UCPT verification
2. **Mesh DHT Integration** - интеграция с Kademlia DHT для peer discovery
3. **Knowledge Graph Sync** - синхронизация knowledge graph через mesh
4. **Byzantine Consensus** - PBFT консенсус для критических операций
5. **Tenant Isolation** - мультитенантность с RLS
6. **Payment Extension** - USDC micropayments на Base L2

### Roadmap

- **Q1 2025**: Full UCPT verification, Mesh DHT
- **Q2 2025**: Knowledge Graph sync, PBFT consensus
- **Q3 2025**: Tenant isolation, Payment extension
- **Q4 2025**: Production deployment на Anóteros Lógos platform

## Ссылки

- [Anóteros Lógos Platform](https://anoteroslogos.com)
- [A2A Protocol Specification](https://anoteroslogos.com/agent-identity)
- [UCPT Documentation](https://anoteroslogos.com/docs/ucpt)
- [CCC Economic Model](https://anoteroslogos.com/docs/ccc)
- [Mesh Network Guide](https://anoteroslogos.com/docs/mesh)

---

**Version**: 1.0.0  
**Last Updated**: November 28, 2025  
**Status**: Production Ready
