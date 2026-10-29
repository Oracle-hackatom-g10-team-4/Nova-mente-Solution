import {test,expect,type Page,type APIRequestContext} from '@playwright/test';

const root='/api/atlas';
async function command(request:APIRequestContext,path:string,data:unknown,key=crypto.randomUUID()){
  return request.post(`${root}/${path}`,{data,headers:{'Idempotency-Key':key}});
}
async function navigate(page:Page,name:string){
  const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name,exact:true}).click();
}

test('study interactions: generate quiz, open its citation and preserve low-stimulus navigation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/workspace');
  await expect(page.getByRole('button',{name:'Criar meu material'})).toBeVisible();
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'Redes E2E.md',mimeType:'text/markdown',buffer:Buffer.from('# Redes E2E\n\nUma VCN conecta sub-redes. NAT permite conexoes de saida.')});
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByText('Personalizar este estudo',{exact:true}).click();
  await page.getByRole('button',{name:'Quiz ativo',exact:true}).click();
  await page.getByLabel('O que você quer compreender?').fill('Compreender os principais conceitos deste documento');
  const prepared=page.waitForResponse(response=>response.url().endsWith('/generations')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Criar meu material'}).click();
  const result=await (await prepared).json();
  const quiz=page.locator('.learning-item').first();
  await expect(quiz.locator('.quiz-option')).toHaveCount(3);
  const original=result.conteudo_adaptado.itens[0].citations[0].excerpt.slice(0,300);
  await quiz.locator('.quiz-option').filter({hasText:original}).first().click();
  await expect(quiz.getByRole('status')).toContainText('+15 XP');
  await quiz.locator('.citation').first().click();
  await expect(page.locator('.archival-paper mark').first()).toBeVisible();
  const close=page.getByRole('button',{name:'Fechar fontes'});
  if(await close.isVisible())await close.click();
  const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});
  if(await menu.isVisible())await menu.click();
  const calm=page.getByRole('button',{name:/Baixo estímulo/});
  await calm.click();await expect(calm).toHaveAttribute('aria-pressed','true');
  const navigation=page.getByRole('dialog',{name:'Seu workspace',exact:true});
  if(await navigation.isVisible())await navigation.getByRole('button',{name:'Fechar',exact:true}).click();
  await expect(page.locator('.atlas-app')).toHaveClass(/calm-mode/);
  await navigate(page,'Trilhas de estudo');
  await expect(page.getByLabel('Qual é seu objetivo de estudo?')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});

test('persistent trail interaction and server gates survive reload',async({page,request})=>{
  await page.goto('/workspace');await navigate(page,'Trilhas de estudo');
  const goal=`Trilha de redes ${crypto.randomUUID().slice(0,8)}`;
  await page.getByLabel('Qual é seu objetivo de estudo?').fill(goal);
  const created=page.waitForResponse(response=>response.url().endsWith('/trails')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Criar trilha',exact:true}).click();
  const trail=await (await created).json();
  const card=page.getByRole('region',{name:`Trilha ${goal}`,exact:true});
  await expect(card.getByRole('button',{name:`Preparar etapa 2 de ${goal}`})).toBeDisabled();
  const forged=await command(request,`trails/${trail.id}/steps/step_2/complete`,{});
  expect(forged.status()).toBe(409);
  await card.getByRole('button',{name:`Preparar etapa 1 de ${goal}`}).click();
  await expect(card.getByRole('button',{name:`Concluir etapa 1 de ${goal}`})).toBeEnabled();
  await card.getByRole('button',{name:`Concluir etapa 1 de ${goal}`}).click();
  await expect(card).toContainText('1 de 4 etapas');
  await page.reload();await navigate(page,'Trilhas de estudo');
  await expect(page.getByRole('region',{name:`Trilha ${goal}`,exact:true})).toContainText('1 de 4 etapas');
  await page.screenshot({path:`artifacts/trails-${test.info().project.name}.png`,fullPage:true});
});

test('HTTP command replay, conflict, invalid key, group/message effects and origin boundary',async({request})=>{
  const key=crypto.randomUUID();const input={name:'Estudo E2E',topic:'Conferir evidências'};
  const first=await command(request,'groups',input,key);expect(first.ok()).toBe(true);
  const group=await first.json();
  const replay=await command(request,'groups',{topic:input.topic,name:input.name},key);
  expect(await replay.json()).toEqual(group);expect(replay.headers()['idempotency-replayed']).toBe('true');
  const alias=await request.post('http://127.0.0.1:4000/V1/Groups/',{data:input,headers:{Authorization:'Bearer e2e-only-internal-token-with-32-characters','Idempotency-Key':key}});
  expect(await alias.json()).toEqual(group);expect(alias.headers()['idempotency-replayed']).toBe('true');
  expect((await command(request,'groups',{...input,name:'Outro'},key)).status()).toBe(409);
  expect((await command(request,'groups',input,'short')).status()).toBe(400);
  const msgKey=crypto.randomUUID();
  const encoded=`http://127.0.0.1:4000/v1/groups/${group.id.replaceAll('_','%5F')}/messages`;
  const internal={Authorization:'Bearer e2e-only-internal-token-with-32-characters','Idempotency-Key':msgKey};
  const msg=await request.post(encoded,{data:{text:'Vamos estudar'},headers:internal});
  expect(msg.url()).toContain('%5F');
  const encodedReplay=await request.post(encoded,{data:{text:'Vamos estudar'},headers:internal});
  expect(await encodedReplay.json()).toEqual(await msg.json());
  expect(encodedReplay.headers()['idempotency-replayed']).toBe('true');
  const msgReplay=await command(request,`groups/${group.id}/messages`,{text:'Vamos estudar'},msgKey);
  expect(await msgReplay.json()).toEqual(await msg.json());
  const list=await (await request.get(`${root}/groups/${group.id}/messages`)).json();expect(list).toHaveLength(1);
  for(const invalid of ['x%2Fy','x%ZZ']){
    const rejected=await request.post(`http://127.0.0.1:4000/v1/groups/${invalid}/messages`,{data:{text:'Inválido'},headers:internal});
    expect(rejected.status()).toBe(400);
  }
  expect((await request.post(`${root}/groups`,{data:input,headers:{Origin:'https://invalid.example'}})).status()).toBe(403);
  expect((await request.get(`${root}/trails/unknown/steps/step_1/input`)).status()).toBe(404);
});

test('full HTTP trail cannot finish quiz before server-verified correct answers',async({request})=>{
  const boot=await (await request.get(`${root}/bootstrap`)).json();
  const trail=await (await command(request,'trails',{document_ids:[boot.documents[0].id],goal:'Revisar os principais conceitos do documento',profile:'beginner',agent_id:'nilo'})).json();
  for(const step of trail.steps){
    const path=`trails/${trail.id}/steps/${step.id}`;
    const prepared=await command(request,`${path}/generate`,{});expect(prepared.ok()).toBe(true);
    const result=await prepared.json();
    if(step.format==='quiz'){
      expect((await command(request,`${path}/complete`,{})).status()).toBe(409);
      for(const item of result.package.conteudo_adaptado.itens){
        for(const option of item.options){
          const answer=await command(request,`quiz/${result.package.id}/attempt`,{item_id:item.id,option_id:option.id,event_id:crypto.randomUUID()});
          if((await answer.json()).correct)break;
        }
      }
    }
    const completed=await command(request,`${path}/complete`,{});expect(completed.ok()).toBe(true);
  }
  const final=await (await request.get(`${root}/trails/${trail.id}`)).json();expect(final.completed_steps).toBe(4);
});

test('companion identity and encrypted manual settings preserve original personas and never echo a key',async({page,request})=>{
  await page.goto('/workspace');
  await expect(page.getByRole('button',{name:'Criar meu material'})).toBeVisible();
  const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name:'Crie seu Atlas',exact:true}).click();
  await page.locator('#companion-name').fill('Órion');
  await page.locator('#companion-guide').selectOption('lumi');
  await page.getByRole('button',{name:'Salvar meu Atlas',exact:true}).click();
  await navigate(page,'Canais dos agentes');
  await expect(page.getByRole('heading',{level:1})).toContainText('Órion');
  await page.reload();await navigate(page,'Canais dos agentes');
  await expect(page.getByRole('heading',{level:1})).toContainText('Órion');
  const boot=await (await request.get(`${root}/bootstrap`)).json();
  expect(boot.agents.find((agent:{id:string})=>agent.id==='lumi').name).toBe('Faísca');
  await page.goto('/workspace/settings');
  await page.getByRole('button',{name:/Minha chave de API/}).click();
  await page.getByRole('combobox',{name:'Provedor',exact:true}).selectOption('openrouter');
  const fake='e2e-fake-provider-key-not-real';
  await page.getByPlaceholder('Cole sua chave aqui').fill(fake);
  await page.getByLabel('Identificador do modelo',{exact:true}).fill('test/model');
  const saved=page.waitForResponse(response=>response.url().endsWith('/connections/generation')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Salvar chave no servidor'}).click();
  expect(await (await saved).text()).not.toContain(fake);
  await expect(page.getByPlaceholder('Cole sua chave aqui')).toHaveValue('');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain(fake);
  await page.getByRole('button',{name:/Gerenciado pelo servidor/}).click();
  await page.getByRole('button',{name:/Usar configuração do servidor/}).click();
  await expect(page.getByText('Chave manual criptografada')).toBeHidden();
  await page.getByRole('button',{name:/Login com ChatGPT/}).click();
  await expect(page.getByRole('button',{name:'Salvar preferência de login local'})).toBeDisabled();
});

test('group messages and consent/erase interactions persist while documents remain',async({page,request})=>{
  await page.goto('/workspace');await navigate(page,'Grupos de estudo');
  await page.getByRole('button',{name:'Criar grupo',exact:true}).click();
  const dialog=page.getByRole('dialog');const name=`Clube ${crypto.randomUUID().slice(0,8)}`;
  await dialog.getByLabel('Nome do grupo').fill(name);
  await dialog.getByLabel('O que vamos estudar?').fill('Revisar redes com evidências');
  await dialog.getByRole('button',{name:'Criar grupo',exact:true}).click();
  await page.getByLabel('Mensagem ao grupo').fill('Vamos conferir a fonte original.');
  await page.getByRole('button',{name:'Enviar ao grupo'}).click();
  await expect(page.getByText('Vamos conferir a fonte original.',{exact:true})).toBeVisible();
  await page.reload();await navigate(page,'Grupos de estudo');
  await page.locator('.group-card').filter({hasText:name}).click();
  await expect(page.getByText('Vamos conferir a fonte original.',{exact:true})).toBeVisible();
  await navigate(page,'Memória & Dreamer');
  const consent=page.getByRole('switch',{name:'Consentir memória de aprendizagem'});
  await expect(consent).toHaveAttribute('aria-checked','false');
  await consent.click();await expect(consent).toHaveAttribute('aria-checked','true');
  await page.getByRole('button',{name:'Iniciar ciclo',exact:true}).click();
  await expect(page.locator('.timeline')).toBeVisible();
  const before=await (await request.get(`${root}/documents`)).json();
  await page.getByRole('button',{name:'Apagar memórias',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Apagar memórias',exact:true}).click();
  await expect(consent).toHaveAttribute('aria-checked','false');
  expect(await (await request.get(`${root}/documents`)).json()).toEqual(before);
});

test('consent, rollback and erasure IDs replay without changing the memory revision',async({request})=>{
  const key=crypto.randomUUID();
  const first=await (await command(request,'dreamer/consent',{enabled:true},key)).json();
  expect(await (await command(request,'dreamer/consent',{enabled:true},key)).json()).toEqual(first);
  const rollbackKey=crypto.randomUUID();
  const rolled=await (await command(request,'dreamer/rollback',{version:0},rollbackKey)).json();
  expect(await (await command(request,'dreamer/rollback',{version:0},rollbackKey)).json()).toEqual(rolled);
  const eraseKey=crypto.randomUUID();
  const options={headers:{'Idempotency-Key':eraseKey}};
  const erased=await request.delete(`${root}/dreamer/memory`,options);expect(erased.ok()).toBe(true);
  const repeated=await request.delete(`${root}/dreamer/memory`,options);
  expect(await repeated.json()).toEqual(await erased.json());expect(repeated.headers()['idempotency-replayed']).toBe('true');
  expect((await command(request,'dreamer/consent',{enabled:true},key)).status()).toBe(409);
});

test('automatic tutor and source removal clean derived history and rebuild using remaining sources',async({page,request},info)=>{
  await page.goto('/workspace');
  const bytes=Buffer.from(`# Fonte removivel ${info.project.name}\n\nUma rede privada usa sub-redes e regras de acesso controladas.`);
  const otherResponse=await request.post(`${root}/documents`,{multipart:{file:{name:`Fonte restante ${info.project.name}.md`,mimeType:'text/markdown',buffer:Buffer.from(`# Outra fonte ${info.project.name}\n\nUma revisao recorrente ajuda a recordar os conceitos.`)}}});
  expect(otherResponse.status()).toBe(201);
  const other=await otherResponse.json();
  await page.reload();
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST');
  await page.locator('input[type=file]').setInputFiles({name:`Remover ${info.project.name}.md`,mimeType:'text/markdown',buffer:bytes});
  const doc=await (await uploaded).json();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('.document-chip').filter({hasText:other.title}).getByRole('checkbox').check();
  await expect(page.getByText('Escolher tutor por mim',{exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Tutor',exact:true})).toBeHidden();
  await page.getByText('Personalizar este estudo',{exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Tutor',exact:true})).toHaveValue('auto');
  await page.getByRole('button',{name:'Quiz ativo',exact:true}).click();
  await page.getByLabel('O que você quer compreender?').fill('Compreender os conceitos de redes privadas');
  const generated=page.waitForResponse(r=>r.url().endsWith('/generations')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Criar meu material'}).click();
  const generationResponse=await generated;
  const oldMaterial=await generationResponse.json();
  const oldKey=generationResponse.request().headers()['idempotency-key'];
  const oldBody=generationResponse.request().postDataJSON();
  expect(oldBody.agent_id).toBe('auto');
  expect(oldMaterial.decision.agent_id).toBe('prisma');expect(oldMaterial.decision.agent_source).toBe('policy');
  const quiz=page.locator('.learning-item').first();
  const original=oldMaterial.conteudo_adaptado.itens[0].citations[0].excerpt.slice(0,300);
  await quiz.locator('.quiz-option').filter({hasText:original}).first().click();
  await expect(quiz.getByRole('status')).toContainText('+15 XP');
  expect(oldMaterial.study_request).not.toHaveProperty('conversation_context');
  expect(oldMaterial.study_request).not.toHaveProperty('decision');
  await page.getByLabel('O que você quer compreender?').fill('Outro objetivo que nao deve alterar o material aberto');
  await page.getByRole('button',{name:'Resumo executivo',exact:true}).click();
  await page.getByRole('button',{name:'Arquiteto',exact:true}).click();
  const trail=await (await command(request,'trails',{document_ids:[doc.id],goal:'Aprender sobre redes privadas',profile:'beginner',agent_id:'nilo'})).json();
  await page.getByRole('button',{name:`Remover fonte ${doc.title}`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Remover fonte?',exact:true});
  await expect(dialog.getByText('1 materiais e 1 trilhas vinculadas',{exact:true})).toBeVisible();
  await expect(dialog.getByText('15 XP vinculado a esses exercícios',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('checkbox').check();
  const deleted=page.waitForResponse(r=>r.url().endsWith(`/documents/${doc.id}`)&&r.request().method()==='DELETE');
  const rebuilt=page.waitForResponse(r=>r.url().endsWith('/generations')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Remover fonte',exact:true}).click();
  expect((await deleted).status()).toBe(200);
  const replacement=await (await rebuilt).json();
  await expect(dialog).toBeHidden();
  expect(replacement.id).not.toBe(oldMaterial.id);
  expect(replacement.document_refs.map((d:{id:string})=>d.id)).toEqual([other.id]);
  expect(replacement.study_request.goal).toBe(oldBody.goal);
  expect(replacement.study_request.profile).toBe(oldBody.profile);
  expect(replacement.study_request.format).toBe(oldBody.format);
  expect(replacement.study_request.agent_id).toBe(oldBody.agent_id);
  expect(replacement.study_request.method).toBe(oldBody.method);
  expect((await request.get(`${root}/documents/${doc.id}/source`)).status()).toBe(404);
  expect((await request.get(`${root}/packages/${oldMaterial.id}`)).status()).toBe(404);
  expect((await request.get(`${root}/trails/${trail.id}`)).status()).toBe(404);
  const replay=await command(request,'generations',oldBody,oldKey);
  expect(replay.status()).toBe(409);
  const deleteKey=crypto.randomUUID();
  const again=await request.delete(`${root}/documents/${doc.id}`,{headers:{'Idempotency-Key':deleteKey}});
  expect(again.status()).toBe(200);
  const second=await request.delete(`${root}/documents/${doc.id}`,{headers:{'Idempotency-Key':deleteKey}});
  expect(second.headers()['idempotency-replayed']).toBe('true');expect(await second.json()).toEqual(await again.json());
  await page.reload();
  await expect(page.getByRole('button',{name:`Remover fonte ${doc.title}`,exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  const uploadedAgain=page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST');
  await page.locator('input[type=file]').setInputFiles({name:`Remover ${info.project.name}.md`,mimeType:'text/markdown',buffer:bytes});
  const newDoc=await (await uploadedAgain).json();
  expect(newDoc.id).not.toBe(doc.id);expect(newDoc.hash).toBe(doc.hash);
  expect((await request.get(`${root}/documents/${doc.id}/source`)).status()).toBe(404);
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.screenshot({path:`artifacts/automatic-studio-${info.project.name}.png`,fullPage:true});
});


test('removing the only source of the open material never substitutes an unrelated document',async({page,request},info)=>{
  await page.goto('/workspace');
  await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/documents')&&r.request().method()==='POST');
  await page.locator('input[type=file]').setInputFiles({name:`Fonte unica ${info.project.name}.md`,mimeType:'text/markdown',buffer:Buffer.from(`# Fonte unica ${info.project.name}\n\nUma fonte precisa ter evidencias reais para ser usada no estudo.`)});
  const doc=await (await uploaded).json();await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('O que você quer compreender?').fill('Explicar as evidencias deste documento');
  const prepared=page.waitForResponse(r=>r.url().endsWith('/generations')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Criar meu material'}).click();
  const material=await (await prepared).json();expect(material.document_refs.map((d:{id:string})=>d.id)).toEqual([doc.id]);
  const boot=await (await request.get(`${root}/bootstrap`)).json();expect(boot.documents.length).toBeGreaterThan(1);
  await page.getByRole('button',{name:`Remover fonte ${doc.title}`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Remover fonte?',exact:true});
  await expect(dialog.getByText(doc.title,{exact:true})).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  const generations:string[]=[];page.on('request',r=>{if(r.url().endsWith('/generations')&&r.method()==='POST')generations.push(r.postData()||'');});
  await dialog.getByRole('button',{name:'Remover fonte',exact:true}).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Seu próximo aprendizado começa aqui.',{exact:true})).toBeVisible();
  expect(generations).toEqual([]);
  expect((await request.get(`${root}/packages/${material.id}`)).status()).toBe(404);
});

// Pending external-service fixture isolates the UI state machine; other deletion tests use real services.
test('pending cleanup can be closed and another source opened without enabling generation',async({page,request},info)=>{
  const form=new FormData();form.append('file',new Blob([`# Pendente ${info.project.name}\n\nO documento aguarda limpeza externa confirmada.`],{type:'text/markdown'}),`Pendente ${info.project.name}.md`);
  const upload=await request.post(`${root}/documents`,{multipart:{file:{name:`Pendente ${info.project.name}.md`,mimeType:'text/markdown',buffer:Buffer.from(await (form.get('file') as Blob).arrayBuffer())}},headers:{'Idempotency-Key':crypto.randomUUID()}});
  expect(upload.ok()).toBe(true);const doc=await upload.json();
  const boot=await (await request.get(`${root}/bootstrap`)).json();
  const other=boot.documents.find((item:{id:string})=>item.id!==doc.id);expect(other).toBeTruthy();
  const pending={document_id:doc.id,status:'cleanup_pending',attention_required:true,impact:{packages:0,trails:0,xp:0,conversations:0,reset_learning_memory:true}};
  let removed=false;
  await page.route(`**/documents/${doc.id}`,async route=>{removed=true;await route.fulfill({status:202,json:pending});});
  await page.route(`**/documents/${doc.id}/removal`,route=>route.fulfill({json:pending}));
  await page.route('**/api/atlas/bootstrap',async route=>{
    if(!removed){await route.continue();return;}
    await route.fulfill({json:{...boot,documents:boot.documents.filter((d:{id:string})=>d.id!==doc.id),pending_removals:[pending]}});
  });
  await page.goto('/workspace');
  await page.getByRole('button',{name:`Remover fonte ${doc.title}`,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Remover fonte?',exact:true});
  await dialog.getByRole('button',{name:'Remover fonte',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('administrador');
  await dialog.getByRole('button',{name:'Fechar',exact:true}).last().click();await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:`Remover fonte ${other.title}`,exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Remover fonte',exact:true})).toBeEnabled();
  await dialog.getByRole('button',{name:'Fechar',exact:true}).last().click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Criar meu material',exact:true})).toBeDisabled();
  await expect(page.getByText('Há uma limpeza de fontes em andamento.',{exact:false})).toBeVisible();
});
