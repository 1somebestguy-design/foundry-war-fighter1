/* Боец — Дитя улицы
 * Foundry VTT v14 / D&D5e 6.0.6.
 */
const MODULE_ID = "foundry-war-fighter1";
const TECHNIQUE_ITEM_IDENTIFIER = "street-techniques";

const TECHNIQUES = {
  stPlexus00000001: { key:"plexus", attack:"stAtkPlexus00001", damage:"stDmgPlexus0001" },
  stLash0000000001: { key:"lash", attack:"stAtkLash000001", damage:"stDmgLash000001" },
  stGrapple0000001: { key:"grapple" },
  stShove000000001: { key:"shove", attack:"stAtkShove00001", damage:"stDmgShove00001" }
};

const warfighter = {
  name:"Боец",
  source:"Дитя улицы",
  features:[
    {name:"Отточенные приемы",level:3,description:"Запас очков приемов равен удвоенному бонусу мастерства. Очки восстанавливаются после короткого или продолжительного отдыха. За один ход можно потратить очки только на один прием."},
    {name:"Сверхъестественное мастерство",level:3,description:"Считайтесь на один размер больше при определении грузоподъемности, толкания, перетаскивания и подъема. Дистанция прыжков удваивается. Скорость увеличивается на 10 футов. Можно тратить 1 очко приемов за каждые дополнительные 5 футов перемещения."},
    {name:"Стальные мускулы",level:7,description:"Если вы не носите доспех и не используете щит, ваш КД равен 12 + модификатор Телосложения. Вы иммунны к состоянию «ошеломлен»."},
    {name:"Опыт мастера",level:10,description:"Получаете слепое зрение в радиусе 15 футов."},
    {name:"Подавляющее преимущество",level:10,description:"При спасброске Ловкости, который обычно уменьшает урон вдвое, успешный спасбросок позволяет не получить урон, а провал — получить половину. Реакцией можно потратить 5 очков приемов, чтобы уклониться от атаки, направленной на вас, и контратаковать."},
    {name:"Выход за предел",level:18,description:"Потратьте очки приемов в количестве, равном числу атак, на которые влияет способность. За каждое потраченное очко получите уровень истощения через 2d4 раунда. Эти атаки совершаются с преимуществом, а их урон нельзя уменьшить никаким способом, включая иммунитет. Восстановление: продолжительный отдых."}
  ],
  techniques:[
    {name:"Удар в сплетение",cost:1,description:"При попадании безоружным ударом цель совершает спасбросок Силы (Сл = 8 + модификатор Силы + бонус мастерства). При провале получает дополнительно 2d6 урона; при успехе — половину."},
    {name:"Хлесткий удар",cost:1,description:"При попадании безоружным ударом цель кровоточит: в начале каждого своего хода в течение 1 минуты получает 1d4 рубящего урона. Эффект прекращается раньше после лечения, использования набора целителя действием или успешной проверки Медицины со Сл приемов. Одновременно действует только одно кровотечение."},
    {name:"Захват и подножка",cost:2,description:"Замените одну атаку попыткой захватить цель или сбить ее с ног. Цель должна быть не более чем на один размер больше вас."},
    {name:"Толчок",cost:1,description:"Замените одну атаку, чтобы толкнуть цель на 10 футов по прямой. При столкновении цель получает 1d4 + модификатор Силы дробящего урона."}
  ],
  unarmedDamage:[
    {level:3,die:"1d4"},{level:5,die:"1d6"},{level:11,die:"1d8"},{level:17,die:"1d10"}
  ]
};

function getTechniqueTurnKey(actor) {
  const combat = game.combat;
  if (!combat?.started || combat.combatant?.actorId !== actor?.id) return null;
  return [combat.id,combat.round,combat.turn,combat.combatant?.id].join(":");
}

function isTechniqueActivity(activity) {
  return activity?.item?.system?.identifier === TECHNIQUE_ITEM_IDENTIFIER
    && Object.hasOwn(TECHNIQUES,activity.id);
}

async function createTechniqueRequest(actor,title,body,key) {
  await ChatMessage.create({
    speaker:ChatMessage.getSpeaker({actor}),
    content:`<div class="dnd5e2"><h3>${title}</h3><p>${body}</p></div>`,
    flags:{[MODULE_ID]:{techniqueRequest:key}}
  });
}

async function performTechnique(activity,usageConfig,results) {
  const actor=activity.actor;
  const technique=TECHNIQUES[activity.id];
  const activities=activity.item.system.activities;
  const message={data:{system:{origin:results.message?.id,targets:[]}}};
  if (technique.attack) {
    const attack=activities.get(technique.attack);
    if (!attack) throw new Error(`Не найдена активность атаки для приема ${technique.key}.`);
    await attack.rollAttack({event:usageConfig.event,target:null},{},message);
  }
  if (technique.key==="plexus") {
    const dc=actor.system.abilities.str.dc
      ?? (8+actor.system.abilities.str.mod+actor.system.attributes.prof);
    await createTechniqueRequest(actor,"Удар в сплетение: спасбросок",
      `Цель совершает спасбросок Силы. Сложность: <strong>${dc}</strong>. При провале дополнительный урон 2d6, при успехе — половина.`,
      technique.key);
  }
  if (technique.key==="grapple") {
    await actor.rollSkill({skill:"ath",event:usageConfig.event},{},message);
    await createTechniqueRequest(actor,"Захват и подножка: встречная проверка",
      "Цель совершает проверку Атлетики или Акробатики — на выбор мастера.",technique.key);
  }
  if (technique.damage) {
    const damage=activities.get(technique.damage);
    if (!damage) throw new Error(`Не найдена активность урона для приема ${technique.key}.`);
    await damage.rollDamage({event:usageConfig.event},{},message);
  }
}

Hooks.once("init",()=>{
  if (CONFIG.DND5E?.armorClasses) {
    CONFIG.DND5E.armorClasses.streetFighter={
      label:"Стальные мускулы",
      formula:"12 + @abilities.con.mod",
      armored:false,
      shielded:false
    };
  }
  const module=game.modules.get(MODULE_ID);
  if (module) module.api={warfighter};
});

Hooks.once("ready",()=>{
  Hooks.on("dnd5e.preUseActivity",activity=>{
    if (!isTechniqueActivity(activity)) return;
    const actor=activity.actor;
    const turnKey=getTechniqueTurnKey(actor);
    if (turnKey && actor.getFlag(MODULE_ID,"lastTechniqueTurn")===turnKey) {
      ui.notifications.warn("За один ход можно использовать только один прием.");
      return false;
    }
  });
  Hooks.on("dnd5e.postUseActivity",(activity,usageConfig,results)=>{
    if (!isTechniqueActivity(activity)) return;
    const actor=activity.actor;
    const turnKey=getTechniqueTurnKey(actor);
    if (turnKey) void actor.setFlag(MODULE_ID,"lastTechniqueTurn",turnKey);
    void performTechnique(activity,usageConfig,results).catch(error=>{
      console.error(`[${MODULE_ID}] Ошибка выполнения приема:`,error);
      ui.notifications.error("Не удалось выполнить прием. Подробности есть в консоли.");
    });
    return false;
  });
  console.info("Боец — Дитя улицы | Механики загружены.");
});
