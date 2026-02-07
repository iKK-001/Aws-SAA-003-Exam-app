/** Mascot 人格化文案池：答对时随机一句 */
export const correctPhrases = [
  '这题拿捏了～',
  '不愧是你！',
  '小本本上又加一分～',
  '继续保持，冲！',
  '思路很清晰嘛',
  '对啦，就是这么回事！',
  '记牢了，考试稳了',
  '嘿嘿，我也觉得你会选对',
  '厉害厉害～',
  '这波操作可以',
  '稳稳的！',
  '懂了这个点就稳了',
];

/** 答错时：安慰、不责备、一起加油 */
export const wrongPhrases = [
  '记下来，下次就不会错啦',
  '没事没事，错题本已经帮你记好啦',
  '这道我也觉得容易混，多看一遍就稳了',
  '咱们一起把它搞懂～',
  '错一次记更牢，下次就对啦',
  '不慌，解析看完就懂了',
  '这里确实容易踩坑，记一下～',
  '摸摸头，下一题继续加油',
  '搞懂这一块就赚到了',
  '我也经常在这类题上纠结，正常～',
  '看完解析再战！',
  '小本本记上，下次秒选对',
];

/** 看解析时：学习向、轻松 */
export const explanationPhrases = [
  '搞懂这一块，考试更稳～',
  '这块记下来很赚的',
  '原来如此，学到了',
  '解析看完就稳了',
  '这种题下次就不会错啦',
  '多看一眼，考场少慌一秒',
  '记牢这个点～',
  '理解比死记有用多了',
  '看完就懂啦，加油',
  '这块考得挺多的，值得记',
  '搞懂原理就不怕变题',
  '小本本+1',
];

/** 做题中（空闲）：每道题一句，不打扰 */
export const idlePhrases = [
  '慢慢想，不着急～',
  '这题我会，你也行的',
  '加油呀～',
  '选完咱们看解析',
  '仔细读题哦',
  '相信自己选的～',
  '想想考点是啥',
  '选好了就点下去',
  '我在这儿陪你刷呢',
  '这题有点意思',
  '稳住，你能对',
  '选完就知道啦',
];

/** 点击 Mascot 彩蛋：鼓励 + 冷笑话/俏皮话 */
export const clickPhrases = [
  '再点我也不会帮你做题的～不过你可以的！',
  '嘿嘿，被你发现了。继续刷题呀～',
  '摸头.jpg 加油！',
  '我是不会告诉你答案的！……因为我也在学',
  '多刷几题，考试稳过～',
  '休息好了吗？休息好了就继续！',
  '据说连续刷题的人都会过～',
  '你今天的努力，考场都会还给你～',
  'S3 是什么？多刷几道就懂了（不是）',
  'Lambda 不是数学那个 λ，是 AWS 的～',
  '云服务：不用自己买服务器的那种好',
  '错题本：你的专属复习清单～',
  '点我也没有隐藏题目啦，乖乖做题～',
  '考试那天你会感谢现在刷题的自己！',
  '今天的你比昨天多会一道题～',
];

/** 有昵称时答对文案：{n} 替换为昵称 */
const correctPhrasesWithNickname = [
  '{n}，这波很棒！',
  '{n}，拿捏了～',
  '{n}，不愧是你！',
  '{n}，继续保持冲！',
  '{n}，思路很清晰嘛',
  '{n}，对啦就是这么回事！',
  '{n}，记牢了考试稳了',
  '{n}，厉害厉害～',
  '{n}，稳稳的！',
  '{n}，懂了这个点就稳了',
];

/** 有昵称时答错文案 */
const wrongPhrasesWithNickname = [
  '{n}，记下来下次就不会错啦',
  '{n}，没事没事错题本记好啦',
  '{n}，咱们一起把它搞懂～',
  '{n}，错一次记更牢下次就对啦',
  '{n}，不慌解析看完就懂了',
  '{n}，摸摸头下一题继续加油',
  '{n}，搞懂这一块就赚到了',
  '{n}，看完解析再战！',
];

/** 首页招呼（有昵称时）：{n} 替换为昵称 */
export const homeGreetingPhrases = [
  '{n}，今天也要冲～',
  '{n}，加油呀～',
  '{n}，今天也要加油呀 ✨',
  '{n}，越刷越顺手 🎯',
];

/** 连续答对阶梯文案 */
export function getStreakTierText(streak: number): string | null {
  if (streak === 3) return '🔥 连胜 3 题！';
  if (streak === 5) return '🔥 五连对！';
  if (streak === 10) return '🔥 十连对！太稳了！';
  return null;
}

export function pickRandom<T>(arr: T[], seed?: number): T {
  const i = seed !== undefined ? seed % arr.length : Math.floor(Math.random() * arr.length);
  return arr[i];
}

/** 答对时一句（有昵称则带昵称） */
export function getCorrectPhrase(nickname?: string): string {
  const name = (nickname ?? '').trim();
  if (name) {
    const t = pickRandom(correctPhrasesWithNickname);
    return t.replace(/{n}/g, name);
  }
  return pickRandom(correctPhrases);
}

/** 答错时一句（有昵称则带昵称） */
export function getWrongPhrase(nickname?: string): string {
  const name = (nickname ?? '').trim();
  if (name) {
    const t = pickRandom(wrongPhrasesWithNickname);
    return t.replace(/{n}/g, name);
  }
  return pickRandom(wrongPhrases);
}

/** 首页招呼（有昵称则带昵称，否则用通用鼓励语） */
export function getHomeGreeting(nickname?: string): string {
  const name = (nickname ?? '').trim();
  if (name) {
    const t = pickRandom(homeGreetingPhrases);
    return t.replace(/{n}/g, name);
  }
  const fallback = ['今天也要加油呀 ✨', '每天进步一点点 🌱', '刷题人，冲！💪', '越刷越顺手 🎯'];
  return fallback[new Date().getDate() % fallback.length];
}
