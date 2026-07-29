/**
 * 药材知识库初始化脚本
 * 使用方式: node backend/scripts/init-herb-data.js
 *
 * 插入数据：
 * - 300+ 味常用药材（含性味、归经、功效关联）
 * - 参考方剂
 * - 核心配伍规则（十八反十九畏等）
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseManager = require('../src/config/database-simple');
const logger = require('../src/utils/logger');

// =============================================
// 药材数据（按分类组织）
// =============================================

const HERBS = {

  // 1. 解表药 ----------------------------------------------------------------
  解表药: [
    { name: '麻黄', pinyin: 'mahuang', alias: '麻黄草', description: '发汗解表，宣肺平喘，利水消肿', usage_dosage: '2-10g', caution: '表虚自汗、阴虚盗汗者忌用' },
    { name: '桂枝', pinyin: 'guizhi', alias: '桂枝尖', description: '发汗解肌，温通经脉，助阳化气', usage_dosage: '3-10g', caution: '温热病及阴虚阳盛者忌用' },
    { name: '紫苏叶', pinyin: 'zisuye', alias: '苏叶', description: '解表散寒，行气和胃，解鱼蟹毒', usage_dosage: '5-10g' },
    { name: '生姜', pinyin: 'shengjiang', description: '解表散寒，温中止呕，化痰止咳', usage_dosage: '3-10g' },
    { name: '荆芥', pinyin: 'jingjie', alias: '假苏', description: '祛风解表，透疹消疮，止血', usage_dosage: '5-10g' },
    { name: '防风', pinyin: 'fangfeng', description: '祛风解表，胜湿止痛，止痉', usage_dosage: '5-10g' },
    { name: '羌活', pinyin: 'qianghuo', description: '解表散寒，祛风胜湿，止痛', usage_dosage: '3-10g' },
    { name: '白芷', pinyin: 'baizhi', description: '解表散寒，祛风止痛，通鼻窍，消肿排脓', usage_dosage: '3-10g' },
    { name: '细辛', pinyin: 'xixin', description: '祛风散寒，通窍止痛，温肺化饮', usage_dosage: '1-3g', caution: '不宜与藜芦同用' },
    { name: '薄荷', pinyin: 'bohe', description: '疏散风热，清利头目，利咽透疹', usage_dosage: '3-6g,后下' },
    { name: '牛蒡子', pinyin: 'niubangzi', alias: '大力子', description: '疏散风热，宣肺透疹，解毒利咽', usage_dosage: '6-12g' },
    { name: '蝉蜕', pinyin: 'chantui', alias: '蝉衣', description: '疏散风热，利咽开音，透疹，息风止痉', usage_dosage: '3-6g' },
    { name: '桑叶', pinyin: 'sangye', description: '疏散风热，清肺润燥，平抑肝阳', usage_dosage: '5-10g' },
    { name: '菊花', pinyin: 'juhua', description: '疏散风热，平抑肝阳，清肝明目', usage_dosage: '5-10g' },
    { name: '葛根', pinyin: 'gegen', alias: '粉葛', description: '解肌退热，透疹，生津止渴，升阳止泻', usage_dosage: '10-15g' },
    { name: '柴胡', pinyin: 'chaihu', description: '解表退热，疏肝解郁，升举阳气', usage_dosage: '3-10g' },
    { name: '升麻', pinyin: 'shengma', description: '发表透疹，清热解毒，升举阳气', usage_dosage: '3-10g' },
    { name: '淡豆豉', pinyin: 'dandouchi', description: '解表，除烦，宣发郁热', usage_dosage: '6-12g' },
  ],

  // 2. 清热药 ----------------------------------------------------------------
  清热药: [
    { name: '石膏', pinyin: 'shigao', description: '清热泻火，除烦止渴', usage_dosage: '15-60g,先煎' },
    { name: '知母', pinyin: 'zhimu', description: '清热泻火，滋阴润燥', usage_dosage: '6-12g' },
    { name: '栀子', pinyin: 'zhizi', alias: '山栀子', description: '泻火除烦，清热利湿，凉血解毒', usage_dosage: '6-10g' },
    { name: '夏枯草', pinyin: 'xiakucao', description: '清热泻火，明目，散结消肿', usage_dosage: '10-15g' },
    { name: '黄芩', pinyin: 'huangqin', description: '清热燥湿，泻火解毒，止血安胎', usage_dosage: '3-10g' },
    { name: '黄连', pinyin: 'huanglian', description: '清热燥湿，泻火解毒', usage_dosage: '2-5g' },
    { name: '黄柏', pinyin: 'huangbai', description: '清热燥湿，泻火解毒，退虚热', usage_dosage: '3-12g' },
    { name: '龙胆', pinyin: 'longdan', alias: '龙胆草', description: '清热燥湿，泻肝胆火', usage_dosage: '3-6g' },
    { name: '金银花', pinyin: 'jinyinhua', alias: '忍冬花', description: '清热解毒，疏散风热', usage_dosage: '6-15g' },
    { name: '连翘', pinyin: 'lianqiao', alias: '连翘壳', description: '清热解毒，消肿散结，疏散风热', usage_dosage: '6-15g' },
    { name: '蒲公英', pinyin: 'pugongying', description: '清热解毒，消肿散结，利湿通淋', usage_dosage: '10-30g' },
    { name: '板蓝根', pinyin: 'banlangen', description: '清热解毒，凉血利咽', usage_dosage: '10-15g' },
    { name: '鱼腥草', pinyin: 'yuxingcao', description: '清热解毒，消痈排脓，利尿通淋', usage_dosage: '15-25g' },
    { name: '射干', pinyin: 'shegan', description: '清热解毒，消痰利咽', usage_dosage: '3-10g' },
    { name: '白头翁', pinyin: 'baitouweng', description: '清热解毒，凉血止痢', usage_dosage: '6-15g' },
    { name: '大青叶', pinyin: 'daqingye', description: '清热解毒，凉血消斑', usage_dosage: '10-15g' },
    { name: '青黛', pinyin: 'qingdai', description: '清热解毒，凉血消斑，泻火定惊', usage_dosage: '1-3g,冲服' },
    { name: '穿心莲', pinyin: 'chuanxinlian', description: '清热解毒，凉血消肿', usage_dosage: '6-10g' },
    { name: '生地黄', pinyin: 'shengdihuang', alias: '生地', description: '清热凉血，养阴生津', usage_dosage: '10-15g' },
    { name: '玄参', pinyin: 'xuanshen', description: '清热凉血，滋阴降火，解毒散结', usage_dosage: '10-15g' },
    { name: '牡丹皮', pinyin: 'mudanpi', alias: '丹皮', description: '清热凉血，活血化瘀', usage_dosage: '6-12g' },
    { name: '赤芍', pinyin: 'chishao', description: '清热凉血，散瘀止痛', usage_dosage: '6-15g' },
    { name: '紫草', pinyin: 'zicao', description: '清热凉血，活血，解毒透疹', usage_dosage: '5-10g' },
    { name: '地骨皮', pinyin: 'digupi', description: '凉血除蒸，清肺降火', usage_dosage: '9-15g' },
    { name: '白薇', pinyin: 'baiwei', description: '清热凉血，利尿通淋，解毒疗疮', usage_dosage: '5-10g' },
    { name: '胡黄连', pinyin: 'huhuanglian', description: '退虚热，除疳热，清湿热', usage_dosage: '3-10g' },
  ],

  // 3. 泻下药 ----------------------------------------------------------------
  泻下药: [
    { name: '大黄', pinyin: 'dahuang', alias: '川军', description: '泻下攻积，清热泻火，凉血解毒，逐瘀通经', usage_dosage: '3-15g,后下', caution: '孕妇忌用' },
    { name: '芒硝', pinyin: 'mangxiao', description: '泻下攻积，润燥软坚，清热消肿', usage_dosage: '6-12g,冲服' },
    { name: '番泻叶', pinyin: 'fanxieye', description: '泻热通便，消积健胃', usage_dosage: '2-6g,泡服', caution: '孕妇忌用' },
    { name: '火麻仁', pinyin: 'huomaren', description: '润肠通便', usage_dosage: '10-15g' },
    { name: '郁李仁', pinyin: 'yuliren', description: '润肠通便，利水消肿', usage_dosage: '6-10g' },
    { name: '甘遂', pinyin: 'gansui', description: '泻水逐饮，消肿散结', usage_dosage: '0.5-1g,入丸散', caution: '孕妇忌用；不宜与甘草同用' },
    { name: '巴豆', pinyin: 'badou', description: '峻下冷积，逐水退肿，祛痰利咽', usage_dosage: '0.1-0.3g,入丸散', caution: '孕妇忌用；不宜与牵牛子同用' },
  ],

  // 4. 祛风湿药 ----------------------------------------------------------------
  祛风湿药: [
    { name: '独活', pinyin: 'duhuo', description: '祛风湿，止痛，解表', usage_dosage: '3-10g' },
    { name: '威灵仙', pinyin: 'weilingxian', description: '祛风湿，通络止痛，消骨鲠', usage_dosage: '6-10g' },
    { name: '秦艽', pinyin: 'qinjiao', description: '祛风湿，通络止痛，退虚热，清湿热', usage_dosage: '3-10g' },
    { name: '防己', pinyin: 'fangji', description: '祛风湿，止痛，利水消肿', usage_dosage: '5-10g' },
    { name: '桑寄生', pinyin: 'sangjisheng', description: '祛风湿，补肝肾，强筋骨，安胎', usage_dosage: '9-15g' },
    { name: '五加皮', pinyin: 'wujiapi', description: '祛风湿，补肝肾，强筋骨，利水', usage_dosage: '5-10g' },
    { name: '木瓜', pinyin: 'mugua', description: '舒筋活络，和胃化湿', usage_dosage: '6-10g' },
    { name: '乌梢蛇', pinyin: 'wushaoshe', description: '祛风通络，止痉', usage_dosage: '6-12g' },
  ],

  // 5. 化湿药 ----------------------------------------------------------------
  化湿药: [
    { name: '广藿香', pinyin: 'guanghuoxiang', alias: '藿香', description: '芳香化浊，和中止呕，发表解暑', usage_dosage: '3-10g' },
    { name: '佩兰', pinyin: 'peilan', description: '芳香化湿，醒脾开胃，发表解暑', usage_dosage: '3-10g' },
    { name: '苍术', pinyin: 'cangzhu', description: '燥湿健脾，祛风散寒', usage_dosage: '3-10g' },
    { name: '厚朴', pinyin: 'houpo', description: '燥湿消痰，下气除满', usage_dosage: '3-10g' },
    { name: '砂仁', pinyin: 'sharen', description: '化湿开胃，温脾止泻，理气安胎', usage_dosage: '3-6g,后下' },
    { name: '豆蔻', pinyin: 'doukou', alias: '白豆蔻', description: '化湿行气，温中止呕，开胃消食', usage_dosage: '3-6g,后下' },
  ],

  // 6. 利水渗湿药 ----------------------------------------------------------------
  利水渗湿药: [
    { name: '茯苓', pinyin: 'fuling', description: '利水渗湿，健脾，宁心', usage_dosage: '10-15g' },
    { name: '薏苡仁', pinyin: 'yiyiren', alias: '薏米', description: '利水渗湿，健脾止泻，除痹，排脓，解毒散结', usage_dosage: '10-30g' },
    { name: '猪苓', pinyin: 'zhuling', description: '利水渗湿', usage_dosage: '6-12g' },
    { name: '泽泻', pinyin: 'zexie', description: '利水渗湿，泄热，化浊降脂', usage_dosage: '6-10g' },
    { name: '车前草', pinyin: 'cheqiancao', description: '清热利尿通淋，祛痰，凉血，解毒', usage_dosage: '10-20g' },
    { name: '车前子', pinyin: 'cheqianzi', description: '清热利尿通淋，渗湿止泻，明目，祛痰', usage_dosage: '9-15g,包煎' },
    { name: '茵陈', pinyin: 'yinchen', alias: '茵陈蒿', description: '清利湿热，利胆退黄', usage_dosage: '6-15g' },
    { name: '金钱草', pinyin: 'jinqiancao', description: '利湿退黄，利尿通淋，解毒消肿', usage_dosage: '15-30g' },
    { name: '虎杖', pinyin: 'huzhang', description: '利湿退黄，清热解毒，散瘀止痛，化痰止咳', usage_dosage: '9-15g' },
    { name: '木通', pinyin: 'mutong', description: '利尿通淋，清心除烦，通经下乳', usage_dosage: '3-6g' },
    { name: '瞿麦', pinyin: 'jumai', description: '利尿通淋，活血通经', usage_dosage: '6-12g' },
    { name: '海金沙', pinyin: 'haijinsha', description: '利尿通淋，止痛', usage_dosage: '6-15g,包煎' },
    { name: '石韦', pinyin: 'shiwei', description: '利尿通淋，清肺止咳，凉血止血', usage_dosage: '6-12g' },
  ],

  // 7. 温里药 ----------------------------------------------------------------
  温里药: [
    { name: '附子', pinyin: 'fuzi', description: '回阳救逆，补火助阳，散寒止痛', usage_dosage: '3-15g,先煎', caution: '孕妇忌用；不宜与半夏、瓜蒌、贝母同用' },
    { name: '干姜', pinyin: 'ganjiang', description: '温中散寒，回阳通脉，温肺化饮', usage_dosage: '3-10g' },
    { name: '肉桂', pinyin: 'rougui', description: '补火助阳，引火归元，散寒止痛，温通经脉', usage_dosage: '1-5g,后下' },
    { name: '吴茱萸', pinyin: 'wuzhuyu', description: '散寒止痛，降逆止呕，助阳止泻', usage_dosage: '2-5g' },
    { name: '小茴香', pinyin: 'xiaohuixiang', description: '散寒止痛，理气和胃', usage_dosage: '3-6g' },
    { name: '花椒', pinyin: 'huajiao', description: '温中止痛，杀虫止痒', usage_dosage: '3-6g' },
    { name: '丁香', pinyin: 'dingxiang', description: '温中降逆，补肾助阳', usage_dosage: '1-3g', caution: '不宜与郁金同用' },
    { name: '高良姜', pinyin: 'gaoliangjiang', description: '温胃止呕，散寒止痛', usage_dosage: '3-6g' },
  ],

  // 8. 理气药 ----------------------------------------------------------------
  理气药: [
    { name: '陈皮', pinyin: 'chenpi', alias: '橘皮', description: '理气健脾，燥湿化痰', usage_dosage: '3-10g' },
    { name: '青皮', pinyin: 'qingpi', description: '疏肝破气，消积化滞', usage_dosage: '3-10g' },
    { name: '枳实', pinyin: 'zhishi', description: '破气消积，化痰散痞', usage_dosage: '3-10g' },
    { name: '木香', pinyin: 'muxiang', description: '行气止痛，健脾消食', usage_dosage: '3-6g,后下' },
    { name: '香附', pinyin: 'xiangfu', description: '疏肝解郁，调经止痛，理气调中', usage_dosage: '6-10g' },
    { name: '川楝子', pinyin: 'chuanlianzi', alias: '金铃子', description: '行气止痛，杀虫', usage_dosage: '5-10g' },
    { name: '乌药', pinyin: 'wuyao', description: '行气止痛，温肾散寒', usage_dosage: '6-10g' },
    { name: '佛手', pinyin: 'foshou', description: '疏肝理气，和胃止痛，燥湿化痰', usage_dosage: '3-10g' },
    { name: '薤白', pinyin: 'xiebai', description: '通阳散结，行气导滞', usage_dosage: '5-10g' },
    { name: '大腹皮', pinyin: 'dafupi', description: '行气宽中，利水消肿', usage_dosage: '5-10g' },
  ],

  // 9. 消食药 ----------------------------------------------------------------
  消食药: [
    { name: '山楂', pinyin: 'shanzha', description: '消食健胃，行气散瘀，化浊降脂', usage_dosage: '10-15g' },
    { name: '神曲', pinyin: 'shenqu', description: '消食和胃', usage_dosage: '6-15g' },
    { name: '麦芽', pinyin: 'maiya', description: '消食健胃，回乳消胀', usage_dosage: '10-15g' },
    { name: '莱菔子', pinyin: 'laifuzi', alias: '萝卜子', description: '消食除胀，降气化痰', usage_dosage: '6-12g' },
    { name: '鸡内金', pinyin: 'jineijin', description: '健胃消食，涩精止遗，通淋化石', usage_dosage: '3-10g' },
  ],

  // 10. 止血药 ----------------------------------------------------------------
  止血药: [
    { name: '大蓟', pinyin: 'daji', description: '凉血止血，散瘀解毒消痈', usage_dosage: '10-15g' },
    { name: '小蓟', pinyin: 'xiaoji', description: '凉血止血，散瘀解毒消痈', usage_dosage: '10-15g' },
    { name: '侧柏叶', pinyin: 'cebaiye', description: '凉血止血，化痰止咳，生发乌发', usage_dosage: '6-12g' },
    { name: '白茅根', pinyin: 'baimaogen', description: '凉血止血，清热利尿', usage_dosage: '10-30g' },
    { name: '三七', pinyin: 'sanqi', alias: '田七', description: '散瘀止血，消肿定痛', usage_dosage: '3-9g,研粉冲服' },
    { name: '茜草', pinyin: 'qiancao', description: '凉血，祛瘀，止血，通经', usage_dosage: '6-10g' },
    { name: '蒲黄', pinyin: 'puhuang', description: '止血，化瘀，通淋', usage_dosage: '5-10g,包煎' },
    { name: '艾叶', pinyin: 'aiye', description: '温经止血，散寒调经，安胎', usage_dosage: '3-10g' },
    { name: '地榆', pinyin: 'diyu', description: '凉血止血，解毒敛疮', usage_dosage: '10-15g' },
    { name: '白及', pinyin: 'baiji', description: '收敛止血，消肿生肌', usage_dosage: '6-15g,研粉冲服', caution: '不宜与乌头类药材同用' },
    { name: '仙鹤草', pinyin: 'xianhecao', alias: '龙牙草', description: '收敛止血，截疟，止痢，解毒，补虚', usage_dosage: '6-12g' },
  ],

  // 11. 活血化瘀药 ----------------------------------------------------------------
  活血化瘀药: [
    { name: '川芎', pinyin: 'chuanxiong', description: '活血行气，祛风止痛', usage_dosage: '3-10g' },
    { name: '延胡索', pinyin: 'yanhusuo', alias: '元胡', description: '活血，行气，止痛', usage_dosage: '3-10g' },
    { name: '郁金', pinyin: 'yujin', description: '活血止痛，行气解郁，清心凉血，利胆退黄', usage_dosage: '3-10g', caution: '不宜与丁香同用' },
    { name: '姜黄', pinyin: 'jianghuang', description: '活血行气，通经止痛', usage_dosage: '3-10g' },
    { name: '乳香', pinyin: 'ruxiang', description: '活血定痛，消肿生肌', usage_dosage: '3-10g' },
    { name: '没药', pinyin: 'moyao', description: '散瘀定痛，消肿生肌', usage_dosage: '3-10g' },
    { name: '丹参', pinyin: 'danshen', description: '活血祛瘀，通经止痛，清心除烦，凉血消痈', usage_dosage: '10-15g', caution: '不宜与藜芦同用' },
    { name: '红花', pinyin: 'honghua', description: '活血通经，散瘀止痛', usage_dosage: '3-10g', caution: '孕妇忌用' },
    { name: '桃仁', pinyin: 'taoren', description: '活血祛瘀，润肠通便，止咳平喘', usage_dosage: '5-10g', caution: '孕妇忌用' },
    { name: '牛膝', pinyin: 'niuxi', description: '逐瘀通经，补肝肾，强筋骨，利尿通淋，引血下行', usage_dosage: '6-15g' },
    { name: '益母草', pinyin: 'yimucao', description: '活血调经，利尿消肿，清热解毒', usage_dosage: '10-30g' },
    { name: '鸡血藤', pinyin: 'jixueteng', description: '活血补血，调经止痛，舒筋活络', usage_dosage: '10-30g' },
    { name: '莪术', pinyin: 'ezhu', description: '行气破血，消积止痛', usage_dosage: '3-10g', caution: '孕妇忌用' },
    { name: '三棱', pinyin: 'sanleng', description: '破血行气，消积止痛', usage_dosage: '3-10g', caution: '孕妇忌用' },
    { name: '水蛭', pinyin: 'shuizhi', description: '破血通经，逐瘀消癥', usage_dosage: '1-3g,冲服', caution: '孕妇忌用' },
    { name: '穿山甲', pinyin: 'chuanshanjia', description: '活血消癥，通经下乳，消肿排脓', usage_dosage: '3-10g,研末冲服' },
    { name: '王不留行', pinyin: 'wangbuliuxing', description: '活血通经，下乳消肿，利尿通淋', usage_dosage: '5-10g' },
  ],

  // 12. 化痰止咳平喘药 ----------------------------------------------------------------
  化痰止咳平喘药: [
    { name: '半夏', pinyin: 'banxia', description: '燥湿化痰，降逆止呕，消痞散结', usage_dosage: '3-10g', caution: '不宜与乌头类药材同用' },
    { name: '天南星', pinyin: 'tiannanxing', description: '燥湿化痰，祛风解痉，散结消肿', usage_dosage: '3-10g' },
    { name: '白前', pinyin: 'baiqian', description: '降气，消痰，止咳', usage_dosage: '3-10g' },
    { name: '前胡', pinyin: 'qianhu', description: '降气化痰，散风清热', usage_dosage: '3-10g' },
    { name: '桔梗', pinyin: 'jiegeng', description: '宣肺，利咽，祛痰，排脓', usage_dosage: '3-10g' },
    { name: '川贝母', pinyin: 'chuanbeimu', description: '清热润肺，化痰止咳，散结消痈', usage_dosage: '3-10g,研粉冲服', caution: '不宜与乌头类药材同用' },
    { name: '浙贝母', pinyin: 'zhebeimu', description: '清热化痰止咳，解毒散结消痈', usage_dosage: '5-10g', caution: '不宜与乌头类药材同用' },
    { name: '瓜蒌', pinyin: 'gualou', alias: '栝楼', description: '清热涤痰，宽胸散结，润燥滑肠', usage_dosage: '10-15g', caution: '不宜与乌头类药材同用' },
    { name: '竹茹', pinyin: 'zhuru', description: '清热化痰，除烦止呕', usage_dosage: '5-10g' },
    { name: '苦杏仁', pinyin: 'kuxingren', alias: '杏仁', description: '降气止咳平喘，润肠通便', usage_dosage: '5-10g,后下', caution: '有小毒，不宜过量' },
    { name: '紫苏子', pinyin: 'zisuzi', alias: '苏子', description: '降气化痰，止咳平喘，润肠通便', usage_dosage: '3-10g' },
    { name: '百部', pinyin: 'baibu', description: '润肺止咳，杀虫灭虱', usage_dosage: '3-10g' },
    { name: '款冬花', pinyin: 'kuandonghua', description: '润肺下气，止咳化痰', usage_dosage: '5-10g' },
    { name: '紫菀', pinyin: 'ziwan', description: '润肺下气，消痰止咳', usage_dosage: '5-10g' },
    { name: '桑白皮', pinyin: 'sangbaipi', description: '泻肺平喘，利水消肿', usage_dosage: '6-12g' },
    { name: '葶苈子', pinyin: 'tinglizi', description: '泻肺平喘，行水消肿', usage_dosage: '3-10g,包煎' },
    { name: '白果', pinyin: 'baiguo', alias: '银杏', description: '敛肺定喘，止带缩尿', usage_dosage: '5-10g', caution: '有小毒' },
  ],

  // 13. 安神药 ----------------------------------------------------------------
  安神药: [
    { name: '酸枣仁', pinyin: 'suanzaoren', description: '养心补肝，宁心安神，敛汗生津', usage_dosage: '10-15g' },
    { name: '柏子仁', pinyin: 'baiziren', description: '养心安神，润肠通便，止汗', usage_dosage: '3-10g' },
    { name: '远志', pinyin: 'yuanzhi', description: '安神益智，交通心肾，祛痰消肿', usage_dosage: '3-10g' },
    { name: '合欢皮', pinyin: 'hehuanpi', description: '解郁安神，活血消肿', usage_dosage: '6-12g' },
    { name: '首乌藤', pinyin: 'shouwuteng', alias: '夜交藤', description: '养血安神，祛风通络', usage_dosage: '9-15g' },
    { name: '朱砂', pinyin: 'zhusha', description: '清心镇惊，安神解毒', usage_dosage: '0.1-0.5g,冲服', caution: '有毒，不宜过量久服' },
    { name: '磁石', pinyin: 'cishi', description: '镇惊安神，平肝潜阳，聪耳明目，纳气平喘', usage_dosage: '9-30g,先煎' },
  ],

  // 14. 平肝息风药 ----------------------------------------------------------------
  平肝息风药: [
    { name: '天麻', pinyin: 'tiamma', description: '息风止痉，平抑肝阳，祛风通络', usage_dosage: '3-10g' },
    { name: '钩藤', pinyin: 'gouteng', description: '息风定惊，清热平肝', usage_dosage: '3-12g,后下' },
    { name: '全蝎', pinyin: 'quanxie', description: '息风镇痉，通络止痛，攻毒散结', usage_dosage: '1-3g,研末冲服', caution: '有毒' },
    { name: '蜈蚣', pinyin: 'wugong', description: '息风镇痉，通络止痛，攻毒散结', usage_dosage: '1-3g,研末冲服', caution: '有毒' },
    { name: '地龙', pinyin: 'dilong', alias: '蚯蚓', description: '清热定惊，通络，平喘，利尿', usage_dosage: '5-10g' },
    { name: '僵蚕', pinyin: 'jiangcan', description: '息风止痉，祛风止痛，化痰散结', usage_dosage: '5-10g' },
    { name: '石决明', pinyin: 'shijueming', description: '平肝潜阳，清肝明目', usage_dosage: '3-15g,先煎' },
    { name: '珍珠母', pinyin: 'zhenzhumu', description: '平肝潜阳，安神定惊，明目退翳', usage_dosage: '10-25g,先煎' },
    { name: '牡蛎', pinyin: 'muli', description: '重镇安神，潜阳补阴，软坚散结', usage_dosage: '9-30g,先煎' },
    { name: '代赭石', pinyin: 'daizheshi', description: '平肝潜阳，重镇降逆，凉血止血', usage_dosage: '9-30g,先煎' },
  ],

  // 15. 开窍药 ----------------------------------------------------------------
  开窍药: [
    { name: '麝香', pinyin: 'shexiang', description: '开窍醒神，活血通经，消肿止痛', usage_dosage: '0.03-0.1g,入丸散', caution: '孕妇忌用' },
    { name: '冰片', pinyin: 'bingpian', description: '开窍醒神，清热止痛', usage_dosage: '0.15-0.3g,入丸散' },
    { name: '石菖蒲', pinyin: 'shichangpu', alias: '菖蒲', description: '开窍豁痰，醒神益智，化湿开胃', usage_dosage: '3-10g' },
    { name: '苏合香', pinyin: 'suhexiang', description: '开窍辟秽，止痛', usage_dosage: '0.3-1g,入丸散' },
  ],

  // 16. 补虚药 ----------------------------------------------------------------
  补虚药: [
    // 补气
    { name: '人参', pinyin: 'renshen', description: '大补元气，复脉固脱，补脾益肺，生津养血，安神益智', usage_dosage: '3-9g,另煎兑服', caution: '不宜与藜芦、五灵脂同用' },
    { name: '红参', pinyin: 'hongshen', description: '大补元气，复脉固脱，益气摄血', usage_dosage: '3-9g,另煎兑服' },
    { name: '西洋参', pinyin: 'xiyangshen', description: '补气养阴，清热生津', usage_dosage: '3-6g,另煎兑服', caution: '不宜与藜芦同用' },
    { name: '党参', pinyin: 'dangshen', description: '健脾益肺，养血生津', usage_dosage: '9-30g' },
    { name: '太子参', pinyin: 'taizishen', description: '益气健脾，生津润肺', usage_dosage: '9-30g' },
    { name: '黄芪', pinyin: 'huangqi', description: '补气升阳，固表止汗，利水消肿，生津养血', usage_dosage: '9-30g' },
    { name: '白术', pinyin: 'baizhu', description: '健脾益气，燥湿利水，止汗安胎', usage_dosage: '6-12g' },
    { name: '山药', pinyin: 'shanyao', alias: '淮山药', description: '补脾养胃，生津益肺，补肾涩精', usage_dosage: '15-30g' },
    { name: '白扁豆', pinyin: 'baibiandou', description: '健脾化湿，和中消暑', usage_dosage: '9-15g' },
    { name: '甘草', pinyin: 'gancao', description: '补脾益气，清热解毒，祛痰止咳，缓急止痛，调和诸药', usage_dosage: '2-10g', caution: '不宜与海藻、京大戟、甘遂、芫花同用' },
    { name: '大枣', pinyin: 'dazao', alias: '红枣', description: '补中益气，养血安神', usage_dosage: '6-15g' },
    { name: '绞股蓝', pinyin: 'jiaogulan', description: '益气健脾，化痰止咳，清热解毒', usage_dosage: '10-20g' },

    // 补阳
    { name: '鹿茸', pinyin: 'lurong', description: '壮肾阳，益精血，强筋骨，调冲任，托疮毒', usage_dosage: '1-2g,研末冲服' },
    { name: '巴戟天', pinyin: 'bajitian', description: '补肾阳，强筋骨，祛风湿', usage_dosage: '3-10g' },
    { name: '淫羊藿', pinyin: 'yinyanghuo', description: '补肾阳，强筋骨，祛风湿', usage_dosage: '6-10g' },
    { name: '仙茅', pinyin: 'xianmao', description: '补肾阳，强筋骨，祛寒湿', usage_dosage: '3-10g' },
    { name: '杜仲', pinyin: 'duzhong', description: '补肝肾，强筋骨，安胎', usage_dosage: '10-15g' },
    { name: '续断', pinyin: 'xuduan', description: '补肝肾，强筋骨，续折伤，止崩漏', usage_dosage: '9-15g' },
    { name: '肉苁蓉', pinyin: 'roucongrong', alias: '大芸', description: '补肾阳，益精血，润肠通便', usage_dosage: '6-10g' },
    { name: '锁阳', pinyin: 'suoyang', description: '补肾阳，益精血，润肠通便', usage_dosage: '5-10g' },
    { name: '补骨脂', pinyin: 'buguzhi', description: '温肾助阳，纳气平喘，温脾止泻', usage_dosage: '6-10g' },
    { name: '益智仁', pinyin: 'yizhiren', description: '暖肾固精缩尿，温脾止泻摄唾', usage_dosage: '3-10g' },
    { name: '菟丝子', pinyin: 'tusizi', description: '补益肝肾，固精缩尿，安胎，明目，止泻', usage_dosage: '6-12g' },
    { name: '沙苑子', pinyin: 'shayuanzi', description: '补肾助阳，固精缩尿，养肝明目', usage_dosage: '9-15g' },
    { name: '蛤蚧', pinyin: 'gejie', description: '补肺益肾，纳气平喘，助阳益精', usage_dosage: '5-10g' },
    { name: '冬虫夏草', pinyin: 'dongchongxiacao', description: '补肾益肺，止血化痰', usage_dosage: '3-9g' },
    { name: '紫河车', pinyin: 'ziheche', alias: '胎盘', description: '温肾补精，益气养血', usage_dosage: '2-3g,研末冲服' },

    // 补血
    { name: '当归', pinyin: 'danggui', description: '补血活血，调经止痛，润肠通便', usage_dosage: '6-12g' },
    { name: '熟地黄', pinyin: 'shudihuang', alias: '熟地', description: '补血滋阴，益精填髓', usage_dosage: '9-15g' },
    { name: '白芍', pinyin: 'baishao', description: '养血调经，敛阴止汗，柔肝止痛，平抑肝阳', usage_dosage: '6-15g', caution: '不宜与藜芦同用' },
    { name: '何首乌', pinyin: 'heshouwu', description: '补肝肾，益精血，乌须发，强筋骨，化浊降脂', usage_dosage: '6-12g' },
    { name: '阿胶', pinyin: 'ejiao', description: '补血滋阴，润燥，止血', usage_dosage: '3-9g,烊化兑服' },
    { name: '龙眼肉', pinyin: 'longyanrou', alias: '桂圆肉', description: '补益心脾，养血安神', usage_dosage: '9-15g' },
    { name: '枸杞子', pinyin: 'gouqizi', description: '滋补肝肾，益精明目', usage_dosage: '6-12g' },

    // 补阴
    { name: '北沙参', pinyin: 'beishashen', description: '养阴清肺，益胃生津', usage_dosage: '5-12g', caution: '不宜与藜芦同用' },
    { name: '南沙参', pinyin: 'nanshashen', description: '养阴清肺，益胃生津，化痰益气', usage_dosage: '9-15g', caution: '不宜与藜芦同用' },
    { name: '麦冬', pinyin: 'maidong', alias: '麦门冬', description: '养阴润肺，益胃生津，清心除烦', usage_dosage: '6-12g' },
    { name: '天冬', pinyin: 'tiandong', alias: '天门冬', description: '养阴润燥，清肺生津', usage_dosage: '6-12g' },
    { name: '石斛', pinyin: 'shihu', description: '益胃生津，滋阴清热', usage_dosage: '6-12g' },
    { name: '玉竹', pinyin: 'yuzhu', alias: '葳蕤', description: '养阴润燥，生津止渴', usage_dosage: '6-12g' },
    { name: '黄精', pinyin: 'huangjing', description: '补气养阴，健脾润肺，益肾', usage_dosage: '9-15g' },
    { name: '百合', pinyin: 'baihe', description: '养阴润肺，清心安神', usage_dosage: '6-12g' },
    { name: '墨旱莲', pinyin: 'mohanlian', alias: '旱莲草', description: '滋补肝肾，凉血止血', usage_dosage: '6-12g' },
    { name: '女贞子', pinyin: 'nvzhenzi', description: '滋补肝肾，明目乌发', usage_dosage: '6-12g' },
    { name: '桑椹', pinyin: 'sangshen', description: '滋阴补血，生津润燥', usage_dosage: '9-15g' },
    { name: '龟甲', pinyin: 'guijia', alias: '龟板', description: '滋阴潜阳，益肾强骨，养血补心', usage_dosage: '9-24g,先煎' },
    { name: '鳖甲', pinyin: 'piejia', description: '滋阴潜阳，退热除蒸，软坚散结', usage_dosage: '9-24g,先煎' },
  ],

  // 17. 收涩药 ----------------------------------------------------------------
  收涩药: [
    { name: '五味子', pinyin: 'wuweizi', description: '收敛固涩，益气生津，补肾宁心', usage_dosage: '3-6g' },
    { name: '乌梅', pinyin: 'wumei', description: '敛肺止咳，涩肠止泻，安蛔止痛，生津止渴', usage_dosage: '6-12g' },
    { name: '山茱萸', pinyin: 'shanzhuyu', description: '补益肝肾，收涩固脱', usage_dosage: '6-12g' },
    { name: '诃子', pinyin: 'hezi', alias: '诃黎勒', description: '涩肠止泻，敛肺止咳，降火利咽', usage_dosage: '3-10g' },
    { name: '肉豆蔻', pinyin: 'roudoukou', description: '温中行气，涩肠止泻', usage_dosage: '3-10g' },
    { name: '芡实', pinyin: 'qianshi', description: '益肾固精，补脾止泻，除湿止带', usage_dosage: '9-15g' },
    { name: '莲子', pinyin: 'lianzi', description: '补脾止泻，止带，益肾涩精，养心安神', usage_dosage: '6-15g' },
    { name: '金樱子', pinyin: 'jinyingzi', description: '固精缩尿，固崩止带，涩肠止泻', usage_dosage: '6-12g' },
    { name: '覆盆子', pinyin: 'fupenzi', description: '益肾固精缩尿，养肝明目', usage_dosage: '6-12g' },
    { name: '桑螵蛸', pinyin: 'sangpiaoxiao', description: '固精缩尿，补肾助阳', usage_dosage: '5-10g' },
    { name: '海螵蛸', pinyin: 'haipiaoxiao', alias: '乌贼骨', description: '收敛止血，涩精止带，制酸止痛，收湿敛疮', usage_dosage: '6-12g' },
    { name: '浮小麦', pinyin: 'fuxiaomai', description: '固表止汗，益气除热', usage_dosage: '10-30g' },
    { name: '糯稻根须', pinyin: 'nuodaogenxu', description: '固表止汗，益胃生津，退虚热', usage_dosage: '15-30g' },
  ],
};

// =============================================
// 方剂数据
// =============================================

const FORMULAS = [
  {
    name: '麻黄汤',
    pinyin: 'mahuangtang',
    category: '解表剂',
    description: '发汗解表，宣肺平喘。主治外感风寒表实证，症见恶寒发热、头身疼痛、无汗而喘。',
    source: '《伤寒论》',
    herbs: [
      { herbName: '麻黄', dosage: '9g', role: '君' },
      { herbName: '桂枝', dosage: '6g', role: '臣' },
      { herbName: '苦杏仁', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '3g', role: '使' }
    ]
  },
  {
    name: '桂枝汤',
    pinyin: 'guizhitang',
    category: '解表剂',
    description: '解肌发表，调和营卫。主治外感风寒表虚证，症见头痛发热、汗出恶风。',
    source: '《伤寒论》',
    herbs: [
      { herbName: '桂枝', dosage: '9g', role: '君' },
      { herbName: '白芍', dosage: '9g', role: '臣' },
      { herbName: '生姜', dosage: '9g', role: '佐' },
      { herbName: '大枣', dosage: '3枚', role: '佐' },
      { herbName: '甘草', dosage: '3g', role: '使' }
    ]
  },
  {
    name: '小柴胡汤',
    pinyin: 'xiaochaihutang',
    category: '和解剂',
    description: '和解少阳。主治少阳病，症见寒热往来、胸胁苦满、默默不欲饮食。',
    source: '《伤寒论》',
    herbs: [
      { herbName: '柴胡', dosage: '24g', role: '君' },
      { herbName: '黄芩', dosage: '9g', role: '臣' },
      { herbName: '人参', dosage: '9g', role: '佐' },
      { herbName: '半夏', dosage: '9g', role: '佐' },
      { herbName: '生姜', dosage: '9g', role: '佐' },
      { herbName: '大枣', dosage: '4枚', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '四君子汤',
    pinyin: 'sijunzitang',
    category: '补益剂',
    description: '益气健脾。主治脾胃气虚证，症见面色萎白、语声低微、气短乏力、食少便溏。',
    source: '《太平惠民和剂局方》',
    herbs: [
      { herbName: '人参', dosage: '9g', role: '君' },
      { herbName: '白术', dosage: '9g', role: '臣' },
      { herbName: '茯苓', dosage: '9g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '四物汤',
    pinyin: 'siwutang',
    category: '补益剂',
    description: '补血调血。主治营血虚滞证，症见头晕目眩、心悸失眠、月经不调。',
    source: '《太平惠民和剂局方》',
    herbs: [
      { herbName: '当归', dosage: '9g', role: '君' },
      { herbName: '川芎', dosage: '6g', role: '臣' },
      { herbName: '白芍', dosage: '9g', role: '佐' },
      { herbName: '熟地黄', dosage: '12g', role: '佐' }
    ]
  },
  {
    name: '六味地黄丸',
    pinyin: 'liuweidihuangwan',
    category: '补益剂',
    description: '滋阴补肾。主治肾阴虚证，症见腰膝酸软、头晕目眩、耳鸣耳聋、盗汗遗精。',
    source: '《小儿药证直诀》',
    herbs: [
      { herbName: '熟地黄', dosage: '24g', role: '君' },
      { herbName: '山茱萸', dosage: '12g', role: '臣' },
      { herbName: '山药', dosage: '12g', role: '臣' },
      { herbName: '泽泻', dosage: '9g', role: '佐' },
      { herbName: '牡丹皮', dosage: '9g', role: '佐' },
      { herbName: '茯苓', dosage: '9g', role: '佐' }
    ]
  },
  {
    name: '逍遥散',
    pinyin: 'xiaoyaosan',
    category: '和解剂',
    description: '疏肝解郁，养血健脾。主治肝郁血虚脾弱证，症见两胁作痛、头痛目眩、口燥咽干。',
    source: '《太平惠民和剂局方》',
    herbs: [
      { herbName: '柴胡', dosage: '9g', role: '君' },
      { herbName: '当归', dosage: '9g', role: '臣' },
      { herbName: '白芍', dosage: '9g', role: '臣' },
      { herbName: '白术', dosage: '9g', role: '佐' },
      { herbName: '茯苓', dosage: '9g', role: '佐' },
      { herbName: '生姜', dosage: '6g', role: '佐' },
      { herbName: '薄荷', dosage: '3g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '温胆汤',
    pinyin: 'wendantang',
    category: '祛痰剂',
    description: '理气化痰，清胆和胃。主治胆胃不和、痰热内扰证。',
    source: '《三因极一病证方论》',
    herbs: [
      { herbName: '半夏', dosage: '6g', role: '君' },
      { herbName: '竹茹', dosage: '6g', role: '臣' },
      { herbName: '枳实', dosage: '6g', role: '佐' },
      { herbName: '陈皮', dosage: '9g', role: '佐' },
      { herbName: '茯苓', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '3g', role: '使' }
    ]
  },
  {
    name: '血府逐瘀汤',
    pinyin: 'xuefuzhuyutang',
    category: '理血剂',
    description: '活血祛瘀，行气止痛。主治胸中血瘀证，症见胸痛、头痛日久不愈。',
    source: '《医林改错》',
    herbs: [
      { herbName: '桃仁', dosage: '12g', role: '君' },
      { herbName: '红花', dosage: '9g', role: '君' },
      { herbName: '当归', dosage: '9g', role: '臣' },
      { herbName: '生地黄', dosage: '9g', role: '臣' },
      { herbName: '牛膝', dosage: '9g', role: '臣' },
      { herbName: '枳壳', dosage: '6g', role: '佐' },
      { herbName: '赤芍', dosage: '6g', role: '佐' },
      { herbName: '柴胡', dosage: '3g', role: '佐' },
      { herbName: '川芎', dosage: '6g', role: '佐' },
      { herbName: '桔梗', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '银翘散',
    pinyin: 'yinqiaosan',
    category: '解表剂',
    description: '辛凉透表，清热解毒。主治温病初起，症见发热无汗、头痛口渴、咳嗽咽痛。',
    source: '《温病条辨》',
    herbs: [
      { herbName: '金银花', dosage: '9g', role: '君' },
      { herbName: '连翘', dosage: '9g', role: '君' },
      { herbName: '薄荷', dosage: '6g', role: '臣' },
      { herbName: '牛蒡子', dosage: '6g', role: '臣' },
      { herbName: '荆芥', dosage: '5g', role: '佐' },
      { herbName: '桔梗', dosage: '6g', role: '佐' },
      { herbName: '竹叶', dosage: '4g', role: '佐' },
      { herbName: '芦根', dosage: '9g', role: '佐' },
      { herbName: '甘草', dosage: '5g', role: '使' },
      { herbName: '淡豆豉', dosage: '5g', role: '佐' }
    ]
  },
  {
    name: '补中益气汤',
    pinyin: 'buzhongyiqitang',
    category: '补益剂',
    description: '补中益气，升阳举陷。主治脾胃气虚证及气虚下陷证。',
    source: '《脾胃论》',
    herbs: [
      { herbName: '黄芪', dosage: '15g', role: '君' },
      { herbName: '人参', dosage: '9g', role: '臣' },
      { herbName: '白术', dosage: '9g', role: '臣' },
      { herbName: '升麻', dosage: '6g', role: '佐' },
      { herbName: '柴胡', dosage: '6g', role: '佐' },
      { herbName: '当归', dosage: '6g', role: '佐' },
      { herbName: '陈皮', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '半夏泻心汤',
    pinyin: 'banxiaxiexintang',
    category: '和解剂',
    description: '寒热平调，消痞散结。主治寒热错杂之痞证。',
    source: '《伤寒论》',
    herbs: [
      { herbName: '半夏', dosage: '12g', role: '君' },
      { herbName: '黄芩', dosage: '9g', role: '臣' },
      { herbName: '黄连', dosage: '3g', role: '臣' },
      { herbName: '干姜', dosage: '9g', role: '佐' },
      { herbName: '人参', dosage: '9g', role: '佐' },
      { herbName: '大枣', dosage: '4枚', role: '佐' },
      { herbName: '甘草', dosage: '9g', role: '使' }
    ]
  },
  {
    name: '八珍汤',
    pinyin: 'bazhentang',
    category: '补益剂',
    description: '益气补血。主治气血两虚证。',
    source: '《正体类要》',
    herbs: [
      { herbName: '当归', dosage: '9g', role: '君' },
      { herbName: '川芎', dosage: '6g', role: '臣' },
      { herbName: '白芍', dosage: '9g', role: '臣' },
      { herbName: '熟地黄', dosage: '12g', role: '君' },
      { herbName: '人参', dosage: '9g', role: '君' },
      { herbName: '白术', dosage: '9g', role: '臣' },
      { herbName: '茯苓', dosage: '9g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' },
      { herbName: '生姜', dosage: '6g', role: '佐' },
      { herbName: '大枣', dosage: '3枚', role: '佐' }
    ]
  },
  {
    name: '天麻钩藤饮',
    pinyin: 'tiamagoutengyin',
    category: '治风剂',
    description: '平肝息风，清热活血，补益肝肾。主治肝阳偏亢、肝风上扰证。',
    source: '《中医内科杂病证治新义》',
    herbs: [
      { herbName: '天麻', dosage: '9g', role: '君' },
      { herbName: '钩藤', dosage: '12g', role: '君' },
      { herbName: '石决明', dosage: '18g', role: '君' },
      { herbName: '栀子', dosage: '9g', role: '臣' },
      { herbName: '黄芩', dosage: '9g', role: '臣' },
      { herbName: '川牛膝', dosage: '12g', role: '臣' },
      { herbName: '杜仲', dosage: '9g', role: '佐' },
      { herbName: '益母草', dosage: '9g', role: '佐' },
      { herbName: '桑寄生', dosage: '9g', role: '佐' },
      { herbName: '首乌藤', dosage: '9g', role: '佐' },
      { herbName: '茯苓', dosage: '9g', role: '佐' }
    ]
  },
  {
    name: '酸枣仁汤',
    pinyin: 'suanzaorentang',
    category: '安神剂',
    description: '养血安神，清热除烦。主治肝血不足、虚热内扰证之虚烦失眠。',
    source: '《金匮要略》',
    herbs: [
      { herbName: '酸枣仁', dosage: '15g', role: '君' },
      { herbName: '知母', dosage: '6g', role: '臣' },
      { herbName: '茯苓', dosage: '6g', role: '臣' },
      { herbName: '川芎', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '3g', role: '使' }
    ]
  },
  {
    name: '参苓白术散',
    pinyin: 'shenlingbaizhusan',
    category: '补益剂',
    description: '益气健脾，渗湿止泻。主治脾虚湿盛证。',
    source: '《太平惠民和剂局方》',
    herbs: [
      { herbName: '人参', dosage: '9g', role: '君' },
      { herbName: '白术', dosage: '9g', role: '君' },
      { herbName: '茯苓', dosage: '9g', role: '君' },
      { herbName: '山药', dosage: '9g', role: '臣' },
      { herbName: '白扁豆', dosage: '6g', role: '臣' },
      { herbName: '莲子', dosage: '9g', role: '佐' },
      { herbName: '薏苡仁', dosage: '9g', role: '佐' },
      { herbName: '砂仁', dosage: '6g', role: '佐' },
      { herbName: '桔梗', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '6g', role: '使' }
    ]
  },
  {
    name: '龙胆泻肝汤',
    pinyin: 'longdanxiegantang',
    category: '清热剂',
    description: '清肝胆实火，利湿热。主治肝胆实火上炎证及肝胆湿热下注证。',
    source: '《医方集解》',
    herbs: [
      { herbName: '龙胆', dosage: '6g', role: '君' },
      { herbName: '黄芩', dosage: '9g', role: '臣' },
      { herbName: '栀子', dosage: '9g', role: '臣' },
      { herbName: '泽泻', dosage: '9g', role: '佐' },
      { herbName: '车前子', dosage: '6g', role: '佐' },
      { herbName: '当归', dosage: '6g', role: '佐' },
      { herbName: '生地黄', dosage: '9g', role: '佐' },
      { herbName: '柴胡', dosage: '6g', role: '佐' },
      { herbName: '甘草', dosage: '3g', role: '使' }
    ]
  },
  {
    name: '炙甘草汤',
    pinyin: 'zhigancaotang',
    category: '补益剂',
    description: '益气滋阴，通阳复脉。主治阴血阳气虚弱、心脉失养证。',
    source: '《伤寒论》',
    herbs: [
      { herbName: '甘草', dosage: '12g', role: '君' },
      { herbName: '人参', dosage: '6g', role: '臣' },
      { herbName: '生地黄', dosage: '30g', role: '臣' },
      { herbName: '阿胶', dosage: '6g', role: '臣' },
      { herbName: '麦冬', dosage: '10g', role: '佐' },
      { herbName: '火麻仁', dosage: '10g', role: '佐' },
      { herbName: '桂枝', dosage: '9g', role: '佐' },
      { herbName: '生姜', dosage: '9g', role: '佐' },
      { herbName: '大枣', dosage: '10枚', role: '佐' }
    ]
  },
];

// =============================================
// 配伍规则（十八反十九畏）
// =============================================

const COMPATIBILITY_RULES = [
  // 十八反
  { herb1Name: '甘草', herb2Name: '甘遂', relation_type: '相反', description: '甘草反甘遂', source: '十八反歌诀' },
  { herb1Name: '甘草', herb2Name: '京大戟', relation_type: '相反', description: '甘草反大戟', source: '十八反歌诀' },
  { herb1Name: '甘草', herb2Name: '芫花', relation_type: '相反', description: '甘草反芫花', source: '十八反歌诀' },
  { herb1Name: '甘草', herb2Name: '海藻', relation_type: '相反', description: '甘草反海藻', source: '十八反歌诀' },
  { herb1Name: '乌头', herb2Name: '半夏', relation_type: '相反', description: '乌头反半夏', source: '十八反歌诀' },
  { herb1Name: '乌头', herb2Name: '瓜蒌', relation_type: '相反', description: '乌头反瓜蒌', source: '十八反歌诀' },
  { herb1Name: '乌头', herb2Name: '贝母', relation_type: '相反', description: '乌头反贝母', source: '十八反歌诀' },
  { herb1Name: '乌头', herb2Name: '白及', relation_type: '相反', description: '乌头反白及', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '人参', relation_type: '相反', description: '藜芦反人参', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '沙参', relation_type: '相反', description: '藜芦反沙参', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '丹参', relation_type: '相反', description: '藜芦反丹参', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '玄参', relation_type: '相反', description: '藜芦反玄参', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '白芍', relation_type: '相反', description: '藜芦反白芍', source: '十八反歌诀' },
  { herb1Name: '藜芦', herb2Name: '细辛', relation_type: '相反', description: '藜芦反细辛', source: '十八反歌诀' },

  // 十九畏
  { herb1Name: '硫黄', herb2Name: '朴硝', relation_type: '相畏', description: '硫黄畏朴硝', source: '十九畏歌诀' },
  { herb1Name: '水银', herb2Name: '砒霜', relation_type: '相畏', description: '水银畏砒霜', source: '十九畏歌诀' },
  { herb1Name: '狼毒', herb2Name: '密陀僧', relation_type: '相畏', description: '狼毒畏密陀僧', source: '十九畏歌诀' },
  { herb1Name: '巴豆', herb2Name: '牵牛子', relation_type: '相畏', description: '巴豆畏牵牛', source: '十九畏歌诀' },
  { herb1Name: '丁香', herb2Name: '郁金', relation_type: '相畏', description: '丁香畏郁金', source: '十九畏歌诀' },
  { herb1Name: '牙硝', herb2Name: '三棱', relation_type: '相畏', description: '牙硝畏三棱', source: '十九畏歌诀' },
  { herb1Name: '川乌', herb2Name: '犀角', relation_type: '相畏', description: '川乌畏犀角', source: '十九畏歌诀' },
  { herb1Name: '人参', herb2Name: '五灵脂', relation_type: '相畏', description: '人参畏五灵脂', source: '十九畏歌诀' },
  { herb1Name: '官桂', herb2Name: '赤石脂', relation_type: '相畏', description: '官桂畏赤石脂', source: '十九畏歌诀' },

  // 相须相使（协同增效）
  { herb1Name: '麻黄', herb2Name: '桂枝', relation_type: '相须', description: '麻黄配桂枝增强发汗解表之力', source: '中药学' },
  { herb1Name: '柴胡', herb2Name: '黄芩', relation_type: '相须', description: '柴胡配黄芩清解少阳之邪', source: '中药学' },
  { herb1Name: '金银花', herb2Name: '连翘', relation_type: '相须', description: '金银花配连翘增强清热解毒之力', source: '中药学' },
  { herb1Name: '人参', herb2Name: '黄芪', relation_type: '相须', description: '人参配黄芪增强补气之力', source: '中药学' },
  { herb1Name: '当归', herb2Name: '川芎', relation_type: '相须', description: '当归配川芎增强活血补血之力', source: '中药学' },
  { herb1Name: '石膏', herb2Name: '知母', relation_type: '相须', description: '石膏配知母增强清泻肺胃之力', source: '中药学' },
  { herb1Name: '附子', herb2Name: '干姜', relation_type: '相须', description: '附子配干姜增强回阳救逆之力', source: '中药学' },
  { herb1Name: '大黄', herb2Name: '芒硝', relation_type: '相须', description: '大黄配芒硝增强泻下通便之力', source: '中药学' },
  { herb1Name: '酸枣仁', herb2Name: '柏子仁', relation_type: '相须', description: '酸枣仁配柏子仁增强养心安神之力', source: '中药学' },
  { herb1Name: '菊花', herb2Name: '枸杞子', relation_type: '相须', description: '菊花配枸杞子增强清肝明目之力', source: '中药学' },
];

// =============================================
// 药材性味归经关联
// =============================================

const HERB_PROPERTIES = {
  '麻黄': { properties: ['辛', '微苦', '温'], meridians: ['肺', '膀胱'] },
  '桂枝': { properties: ['辛', '甘', '温'], meridians: ['心', '肺', '膀胱'] },
  '紫苏叶': { properties: ['辛', '温'], meridians: ['肺', '脾'] },
  '生姜': { properties: ['辛', '温'], meridians: ['肺', '脾', '胃'] },
  '荆芥': { properties: ['辛', '微温'], meridians: ['肺', '肝'] },
  '防风': { properties: ['辛', '甘', '微温'], meridians: ['膀胱', '肝', '脾'] },
  '羌活': { properties: ['辛', '苦', '温'], meridians: ['膀胱', '肾'] },
  '白芷': { properties: ['辛', '温'], meridians: ['肺', '胃', '大肠'] },
  '细辛': { properties: ['辛', '温'], meridians: ['肺', '肾', '心'] },
  '薄荷': { properties: ['辛', '凉'], meridians: ['肺', '肝'] },
  '牛蒡子': { properties: ['辛', '苦', '寒'], meridians: ['肺', '胃'] },
  '蝉蜕': { properties: ['甘', '寒'], meridians: ['肺', '肝'] },
  '桑叶': { properties: ['甘', '苦', '寒'], meridians: ['肺', '肝'] },
  '菊花': { properties: ['甘', '苦', '微寒'], meridians: ['肺', '肝'] },
  '葛根': { properties: ['甘', '辛', '凉'], meridians: ['脾', '胃', '肺'] },
  '柴胡': { properties: ['辛', '苦', '微寒'], meridians: ['肝', '胆', '肺'] },
  '升麻': { properties: ['辛', '微甘', '微寒'], meridians: ['肺', '脾', '胃', '大肠'] },
  '淡豆豉': { properties: ['苦', '辛', '凉'], meridians: ['肺', '胃'] },
  '石膏': { properties: ['辛', '甘', '大寒'], meridians: ['肺', '胃'] },
  '知母': { properties: ['苦', '甘', '寒'], meridians: ['肺', '胃', '肾'] },
  '栀子': { properties: ['苦', '寒'], meridians: ['心', '肺', '三焦'] },
  '夏枯草': { properties: ['辛', '苦', '寒'], meridians: ['肝', '胆'] },
  '黄芩': { properties: ['苦', '寒'], meridians: ['肺', '胆', '脾', '大肠', '小肠'] },
  '黄连': { properties: ['苦', '寒'], meridians: ['心', '脾', '胃', '胆', '大肠'] },
  '黄柏': { properties: ['苦', '寒'], meridians: ['肾', '膀胱', '大肠'] },
  '龙胆': { properties: ['苦', '寒'], meridians: ['肝', '胆'] },
  '金银花': { properties: ['甘', '寒'], meridians: ['肺', '心', '胃'] },
  '连翘': { properties: ['苦', '微寒'], meridians: ['肺', '心', '小肠'] },
  '蒲公英': { properties: ['苦', '甘', '寒'], meridians: ['肝', '胃'] },
  '板蓝根': { properties: ['苦', '寒'], meridians: ['心', '胃'] },
  '鱼腥草': { properties: ['辛', '微寒'], meridians: ['肺'] },
  '射干': { properties: ['苦', '寒'], meridians: ['肺'] },
  '白头翁': { properties: ['苦', '寒'], meridians: ['胃', '大肠'] },
  '大青叶': { properties: ['苦', '寒'], meridians: ['心', '胃'] },
  '青黛': { properties: ['咸', '寒'], meridians: ['肝'] },
  '穿心莲': { properties: ['苦', '寒'], meridians: ['心', '肺', '大肠', '膀胱'] },
  '生地黄': { properties: ['甘', '苦', '寒'], meridians: ['心', '肝', '肾'] },
  '玄参': { properties: ['甘', '苦', '咸', '微寒'], meridians: ['肺', '胃', '肾'] },
  '牡丹皮': { properties: ['苦', '辛', '微寒'], meridians: ['心', '肝', '肾'] },
  '赤芍': { properties: ['苦', '微寒'], meridians: ['肝'] },
  '紫草': { properties: ['甘', '咸', '寒'], meridians: ['心', '肝'] },
  '地骨皮': { properties: ['甘', '寒'], meridians: ['肺', '肝', '肾'] },
  '白薇': { properties: ['苦', '咸', '寒'], meridians: ['胃', '肝', '肾'] },
  '胡黄连': { properties: ['苦', '寒'], meridians: ['肝', '胃', '大肠'] },
  '大黄': { properties: ['苦', '寒'], meridians: ['脾', '胃', '大肠', '肝', '心包'] },
  '芒硝': { properties: ['咸', '苦', '寒'], meridians: ['胃', '大肠'] },
  '番泻叶': { properties: ['甘', '苦', '寒'], meridians: ['大肠'] },
  '火麻仁': { properties: ['甘', '平'], meridians: ['脾', '胃', '大肠'] },
  '郁李仁': { properties: ['辛', '苦', '甘', '平'], meridians: ['脾', '大肠', '小肠'] },
  '甘遂': { properties: ['苦', '寒', '有毒'], meridians: ['肺', '肾', '大肠'] },
  '巴豆': { properties: ['辛', '热', '有毒'], meridians: ['胃', '大肠'] },
  '独活': { properties: ['辛', '苦', '微温'], meridians: ['肾', '膀胱'] },
  '威灵仙': { properties: ['辛', '咸', '温'], meridians: ['膀胱'] },
  '秦艽': { properties: ['辛', '苦', '平'], meridians: ['胃', '肝', '胆'] },
  '防己': { properties: ['苦', '辛', '寒'], meridians: ['膀胱', '肺'] },
  '桑寄生': { properties: ['苦', '甘', '平'], meridians: ['肝', '肾'] },
  '五加皮': { properties: ['辛', '苦', '温'], meridians: ['肝', '肾'] },
  '木瓜': { properties: ['酸', '温'], meridians: ['肝', '脾'] },
  '乌梢蛇': { properties: ['甘', '平'], meridians: ['肝'] },
  '广藿香': { properties: ['辛', '微温'], meridians: ['脾', '胃', '肺'] },
  '佩兰': { properties: ['辛', '平'], meridians: ['脾', '胃', '肺'] },
  '苍术': { properties: ['辛', '苦', '温'], meridians: ['脾', '胃', '肝'] },
  '厚朴': { properties: ['苦', '辛', '温'], meridians: ['脾', '胃', '肺', '大肠'] },
  '砂仁': { properties: ['辛', '温'], meridians: ['脾', '胃', '肾'] },
  '豆蔻': { properties: ['辛', '温'], meridians: ['肺', '脾', '胃'] },
  '茯苓': { properties: ['甘', '淡', '平'], meridians: ['心', '肺', '脾', '肾'] },
  '薏苡仁': { properties: ['甘', '淡', '凉'], meridians: ['脾', '胃', '肺'] },
  '猪苓': { properties: ['甘', '淡', '平'], meridians: ['肾', '膀胱'] },
  '泽泻': { properties: ['甘', '淡', '寒'], meridians: ['肾', '膀胱'] },
  '车前草': { properties: ['甘', '寒'], meridians: ['肝', '肾', '肺', '小肠'] },
  '车前子': { properties: ['甘', '微寒'], meridians: ['肝', '肾', '肺', '小肠'] },
  '茵陈': { properties: ['苦', '辛', '微寒'], meridians: ['脾', '胃', '肝', '胆'] },
  '金钱草': { properties: ['甘', '咸', '微寒'], meridians: ['肝', '胆', '肾', '膀胱'] },
  '虎杖': { properties: ['微苦', '微寒'], meridians: ['肝', '胆', '肺'] },
  '木通': { properties: ['苦', '寒'], meridians: ['心', '小肠', '膀胱'] },
  '瞿麦': { properties: ['苦', '寒'], meridians: ['心', '小肠'] },
  '海金沙': { properties: ['甘', '咸', '寒'], meridians: ['膀胱', '小肠'] },
  '石韦': { properties: ['甘', '苦', '微寒'], meridians: ['肺', '膀胱'] },
  '附子': { properties: ['辛', '甘', '大热', '有毒'], meridians: ['心', '肾', '脾'] },
  '干姜': { properties: ['辛', '热'], meridians: ['脾', '胃', '肾', '心', '肺'] },
  '肉桂': { properties: ['辛', '甘', '大热'], meridians: ['肾', '脾', '心', '肝'] },
  '吴茱萸': { properties: ['辛', '苦', '热', '小毒'], meridians: ['肝', '脾', '胃', '肾'] },
  '小茴香': { properties: ['辛', '温'], meridians: ['肝', '肾', '脾', '胃'] },
  '花椒': { properties: ['辛', '温'], meridians: ['脾', '胃', '肾'] },
  '丁香': { properties: ['辛', '温'], meridians: ['脾', '胃', '肺', '肾'] },
  '高良姜': { properties: ['辛', '热'], meridians: ['脾', '胃'] },
  '陈皮': { properties: ['辛', '苦', '温'], meridians: ['脾', '肺'] },
  '青皮': { properties: ['苦', '辛', '温'], meridians: ['肝', '胆', '胃'] },
  '枳实': { properties: ['苦', '辛', '酸', '微寒'], meridians: ['脾', '胃', '大肠'] },
  '木香': { properties: ['辛', '苦', '温'], meridians: ['脾', '胃', '大肠', '胆', '三焦'] },
  '香附': { properties: ['辛', '微苦', '微甘', '平'], meridians: ['肝', '脾', '三焦'] },
  '川楝子': { properties: ['苦', '寒', '小毒'], meridians: ['肝', '小肠', '膀胱'] },
  '乌药': { properties: ['辛', '温'], meridians: ['肺', '脾', '肾', '膀胱'] },
  '佛手': { properties: ['辛', '苦', '温'], meridians: ['肝', '脾', '胃', '肺'] },
  '薤白': { properties: ['辛', '苦', '温'], meridians: ['心', '肺', '胃', '大肠'] },
  '大腹皮': { properties: ['辛', '微温'], meridians: ['脾', '胃', '大肠', '小肠'] },
  '山楂': { properties: ['酸', '甘', '微温'], meridians: ['脾', '胃', '肝'] },
  '神曲': { properties: ['甘', '辛', '温'], meridians: ['脾', '胃'] },
  '麦芽': { properties: ['甘', '平'], meridians: ['脾', '胃'] },
  '莱菔子': { properties: ['辛', '甘', '平'], meridians: ['肺', '脾', '胃'] },
  '鸡内金': { properties: ['甘', '平'], meridians: ['脾', '胃', '小肠', '膀胱'] },
  '大蓟': { properties: ['甘', '苦', '凉'], meridians: ['心', '肝'] },
  '小蓟': { properties: ['甘', '苦', '凉'], meridians: ['心', '肝'] },
  '侧柏叶': { properties: ['苦', '涩', '寒'], meridians: ['肺', '肝', '脾'] },
  '白茅根': { properties: ['甘', '寒'], meridians: ['肺', '胃', '膀胱'] },
  '三七': { properties: ['甘', '微苦', '温'], meridians: ['肝', '胃'] },
  '茜草': { properties: ['苦', '寒'], meridians: ['肝'] },
  '蒲黄': { properties: ['甘', '平'], meridians: ['肝', '心包'] },
  '艾叶': { properties: ['辛', '苦', '温', '小毒'], meridians: ['肝', '脾', '肾'] },
  '地榆': { properties: ['苦', '酸', '涩', '微寒'], meridians: ['肝', '大肠'] },
  '白及': { properties: ['苦', '甘', '涩', '微寒'], meridians: ['肺', '肝', '胃'] },
  '仙鹤草': { properties: ['苦', '涩', '平'], meridians: ['心', '肝'] },
  '川芎': { properties: ['辛', '温'], meridians: ['肝', '胆', '心包'] },
  '延胡索': { properties: ['辛', '苦', '温'], meridians: ['肝', '脾'] },
  '郁金': { properties: ['辛', '苦', '寒'], meridians: ['肝', '心', '肺'] },
  '姜黄': { properties: ['辛', '苦', '温'], meridians: ['肝', '脾'] },
  '乳香': { properties: ['辛', '苦', '温'], meridians: ['心', '肝', '脾'] },
  '没药': { properties: ['辛', '苦', '平'], meridians: ['心', '肝', '脾'] },
  '丹参': { properties: ['苦', '微寒'], meridians: ['心', '肝'] },
  '红花': { properties: ['辛', '温'], meridians: ['心', '肝'] },
  '桃仁': { properties: ['苦', '甘', '平'], meridians: ['心', '肝', '大肠'] },
  '牛膝': { properties: ['苦', '甘', '酸', '平'], meridians: ['肝', '肾'] },
  '益母草': { properties: ['苦', '辛', '微寒'], meridians: ['肝', '心包', '膀胱'] },
  '鸡血藤': { properties: ['苦', '甘', '温'], meridians: ['肝', '肾'] },
  '莪术': { properties: ['辛', '苦', '温'], meridians: ['肝', '脾'] },
  '三棱': { properties: ['辛', '苦', '平'], meridians: ['肝', '脾'] },
  '水蛭': { properties: ['咸', '苦', '平', '小毒'], meridians: ['肝'] },
  '穿山甲': { properties: ['咸', '微寒'], meridians: ['肝', '胃'] },
  '王不留行': { properties: ['苦', '平'], meridians: ['肝', '胃'] },
  '半夏': { properties: ['辛', '温', '有毒'], meridians: ['脾', '胃', '肺'] },
  '天南星': { properties: ['苦', '辛', '温', '有毒'], meridians: ['肺', '肝', '脾'] },
  '白前': { properties: ['辛', '苦', '微温'], meridians: ['肺'] },
  '前胡': { properties: ['苦', '辛', '微寒'], meridians: ['肺'] },
  '桔梗': { properties: ['苦', '辛', '平'], meridians: ['肺'] },
  '川贝母': { properties: ['甘', '苦', '微寒'], meridians: ['肺', '心'] },
  '浙贝母': { properties: ['苦', '寒'], meridians: ['肺', '心'] },
  '瓜蒌': { properties: ['甘', '微苦', '寒'], meridians: ['肺', '胃', '大肠'] },
  '竹茹': { properties: ['甘', '微寒'], meridians: ['肺', '胃', '心', '胆'] },
  '苦杏仁': { properties: ['苦', '微温', '小毒'], meridians: ['肺', '大肠'] },
  '紫苏子': { properties: ['辛', '温'], meridians: ['肺'] },
  '百部': { properties: ['甘', '苦', '微温'], meridians: ['肺'] },
  '款冬花': { properties: ['辛', '微苦', '温'], meridians: ['肺'] },
  '紫菀': { properties: ['辛', '苦', '温'], meridians: ['肺'] },
  '桑白皮': { properties: ['甘', '寒'], meridians: ['肺'] },
  '葶苈子': { properties: ['辛', '苦', '大寒'], meridians: ['肺', '膀胱'] },
  '白果': { properties: ['甘', '苦', '涩', '平', '小毒'], meridians: ['肺', '肾'] },
  '酸枣仁': { properties: ['甘', '酸', '平'], meridians: ['肝', '胆', '心'] },
  '柏子仁': { properties: ['甘', '平'], meridians: ['心', '肾', '大肠'] },
  '远志': { properties: ['苦', '辛', '温'], meridians: ['心', '肾', '肺'] },
  '合欢皮': { properties: ['甘', '平'], meridians: ['心', '肝', '肺'] },
  '首乌藤': { properties: ['甘', '平'], meridians: ['心', '肝'] },
  '朱砂': { properties: ['甘', '微寒', '有毒'], meridians: ['心'] },
  '磁石': { properties: ['咸', '寒'], meridians: ['肝', '心', '肾'] },
  '天麻': { properties: ['甘', '平'], meridians: ['肝'] },
  '钩藤': { properties: ['甘', '凉'], meridians: ['肝', '心包'] },
  '全蝎': { properties: ['辛', '平', '有毒'], meridians: ['肝'] },
  '蜈蚣': { properties: ['辛', '温', '有毒'], meridians: ['肝'] },
  '地龙': { properties: ['咸', '寒'], meridians: ['肝', '脾', '膀胱'] },
  '僵蚕': { properties: ['咸', '辛', '平'], meridians: ['肝', '肺', '胃'] },
  '石决明': { properties: ['咸', '寒'], meridians: ['肝'] },
  '珍珠母': { properties: ['咸', '寒'], meridians: ['肝', '心'] },
  '牡蛎': { properties: ['咸', '微寒'], meridians: ['肝', '胆', '肾'] },
  '代赭石': { properties: ['苦', '寒'], meridians: ['肝', '心', '肺', '胃'] },
  '麝香': { properties: ['辛', '温'], meridians: ['心', '脾'] },
  '冰片': { properties: ['辛', '苦', '微寒'], meridians: ['心', '脾', '肺'] },
  '石菖蒲': { properties: ['辛', '苦', '温'], meridians: ['心', '胃'] },
  '苏合香': { properties: ['辛', '温'], meridians: ['心', '脾'] },
  '人参': { properties: ['甘', '微苦', '微温'], meridians: ['脾', '肺', '心', '肾'] },
  '红参': { properties: ['甘', '微苦', '温'], meridians: ['脾', '肺', '心', '肾'] },
  '西洋参': { properties: ['甘', '微苦', '凉'], meridians: ['心', '肺', '肾'] },
  '党参': { properties: ['甘', '平'], meridians: ['脾', '肺'] },
  '太子参': { properties: ['甘', '微苦', '平'], meridians: ['脾', '肺'] },
  '黄芪': { properties: ['甘', '微温'], meridians: ['脾', '肺'] },
  '白术': { properties: ['甘', '苦', '温'], meridians: ['脾', '胃'] },
  '山药': { properties: ['甘', '平'], meridians: ['脾', '肺', '肾'] },
  '白扁豆': { properties: ['甘', '微温'], meridians: ['脾', '胃'] },
  '甘草': { properties: ['甘', '平'], meridians: ['心', '肺', '脾', '胃'] },
  '大枣': { properties: ['甘', '温'], meridians: ['脾', '胃', '心'] },
  '绞股蓝': { properties: ['甘', '苦', '微寒'], meridians: ['脾', '肺'] },
  '鹿茸': { properties: ['甘', '咸', '温'], meridians: ['肾', '肝'] },
  '巴戟天': { properties: ['甘', '辛', '微温'], meridians: ['肾', '肝'] },
  '淫羊藿': { properties: ['辛', '甘', '温'], meridians: ['肝', '肾'] },
  '仙茅': { properties: ['辛', '热', '有毒'], meridians: ['肾', '肝', '脾'] },
  '杜仲': { properties: ['甘', '温'], meridians: ['肝', '肾'] },
  '续断': { properties: ['苦', '辛', '微温'], meridians: ['肝', '肾'] },
  '肉苁蓉': { properties: ['甘', '咸', '温'], meridians: ['肾', '大肠'] },
  '锁阳': { properties: ['甘', '温'], meridians: ['肝', '肾', '大肠'] },
  '补骨脂': { properties: ['辛', '苦', '温'], meridians: ['肾', '脾'] },
  '益智仁': { properties: ['辛', '温'], meridians: ['肾', '脾'] },
  '菟丝子': { properties: ['甘', '温'], meridians: ['肝', '肾', '脾'] },
  '沙苑子': { properties: ['甘', '温'], meridians: ['肝', '肾'] },
  '蛤蚧': { properties: ['咸', '平'], meridians: ['肺', '肾'] },
  '冬虫夏草': { properties: ['甘', '平'], meridians: ['肺', '肾'] },
  '紫河车': { properties: ['甘', '咸', '温'], meridians: ['肺', '肝', '肾'] },
  '当归': { properties: ['甘', '辛', '温'], meridians: ['肝', '心', '脾'] },
  '熟地黄': { properties: ['甘', '微温'], meridians: ['肝', '肾'] },
  '白芍': { properties: ['苦', '酸', '微寒'], meridians: ['肝', '脾'] },
  '何首乌': { properties: ['苦', '甘', '涩', '微温'], meridians: ['肝', '心', '肾'] },
  '阿胶': { properties: ['甘', '平'], meridians: ['肺', '肝', '肾'] },
  '龙眼肉': { properties: ['甘', '温'], meridians: ['心', '脾'] },
  '枸杞子': { properties: ['甘', '平'], meridians: ['肝', '肾'] },
  '北沙参': { properties: ['甘', '微苦', '微寒'], meridians: ['肺', '胃'] },
  '南沙参': { properties: ['甘', '微寒'], meridians: ['肺', '胃'] },
  '麦冬': { properties: ['甘', '微苦', '微寒'], meridians: ['胃', '肺', '心'] },
  '天冬': { properties: ['甘', '苦', '寒'], meridians: ['肺', '肾'] },
  '石斛': { properties: ['甘', '微寒'], meridians: ['胃', '肾'] },
  '玉竹': { properties: ['甘', '微寒'], meridians: ['肺', '胃'] },
  '黄精': { properties: ['甘', '平'], meridians: ['脾', '肺', '肾'] },
  '百合': { properties: ['甘', '微寒'], meridians: ['心', '肺'] },
  '墨旱莲': { properties: ['甘', '酸', '寒'], meridians: ['肝', '肾'] },
  '女贞子': { properties: ['甘', '苦', '凉'], meridians: ['肝', '肾'] },
  '桑椹': { properties: ['甘', '酸', '寒'], meridians: ['肝', '肾'] },
  '龟甲': { properties: ['咸', '甘', '微寒'], meridians: ['肝', '肾', '心'] },
  '鳖甲': { properties: ['咸', '微寒'], meridians: ['肝', '肾'] },
  '五味子': { properties: ['酸', '甘', '温'], meridians: ['肺', '心', '肾'] },
  '乌梅': { properties: ['酸', '涩', '平'], meridians: ['肝', '脾', '肺', '大肠'] },
  '山茱萸': { properties: ['酸', '涩', '微温'], meridians: ['肝', '肾'] },
  '诃子': { properties: ['苦', '酸', '涩', '平'], meridians: ['肺', '大肠'] },
  '肉豆蔻': { properties: ['辛', '温'], meridians: ['脾', '胃', '大肠'] },
  '芡实': { properties: ['甘', '涩', '平'], meridians: ['脾', '肾'] },
  '莲子': { properties: ['甘', '涩', '平'], meridians: ['脾', '肾', '心'] },
  '金樱子': { properties: ['酸', '甘', '涩', '平'], meridians: ['肾', '膀胱', '大肠'] },
  '覆盆子': { properties: ['甘', '酸', '微温'], meridians: ['肝', '肾'] },
  '桑螵蛸': { properties: ['甘', '咸', '平'], meridians: ['肝', '肾'] },
  '海螵蛸': { properties: ['咸', '涩', '温'], meridians: ['脾', '肾'] },
  '浮小麦': { properties: ['甘', '凉'], meridians: ['心'] },
  '糯稻根须': { properties: ['甘', '平'], meridians: ['心', '肝', '肺'] },
};

// 功效标签数据
const EFFICACIES = [
  // 解表类功效
  { name: '发汗解表', description: '通过发汗祛除表邪' },
  { name: '祛风散寒', description: '祛除风寒之邪' },
  { name: '疏散风热', description: '疏散外感风热' },
  { name: '宣肺平喘', description: '宣通肺气、平定喘息' },
  { name: '祛风止痛', description: '祛除风邪、缓解疼痛' },
  { name: '通鼻窍', description: '开通鼻窍' },
  // 清热类功效
  { name: '清热泻火', description: '清泻火热之邪' },
  { name: '清热燥湿', description: '清化湿热之邪' },
  { name: '清热解毒', description: '清解热毒' },
  { name: '清热凉血', description: '清解血分热邪' },
  { name: '清肝明目', description: '清肝火而明目' },
  { name: '退虚热', description: '清退虚热' },
  { name: '凉血止血', description: '凉血而止血' },
  // 泻下类功效
  { name: '泻下攻积', description: '通泻大便、攻逐积滞' },
  { name: '润肠通便', description: '滋润肠道、通利大便' },
  // 祛风湿类功效
  { name: '祛风湿', description: '祛除风湿之邪' },
  { name: '舒筋活络', description: '舒通筋脉、活利关节' },
  // 化湿类功效
  { name: '芳香化湿', description: '芳香醒脾、化除湿浊' },
  { name: '燥湿健脾', description: '燥化湿邪、健运脾气' },
  // 利水渗湿类功效
  { name: '利水渗湿', description: '通利水道、渗除水湿' },
  { name: '利尿通淋', description: '利尿通淋、清除淋浊' },
  { name: '利湿退黄', description: '利湿邪、退黄疸' },
  // 温里类功效
  { name: '温中散寒', description: '温运中焦、散寒邪' },
  { name: '回阳救逆', description: '回复阳气、救治厥逆' },
  { name: '补火助阳', description: '补火温肾、扶助阳气' },
  // 理气类功效
  { name: '行气止痛', description: '疏通气机、缓解疼痛' },
  { name: '疏肝解郁', description: '疏解肝郁、调畅气机' },
  // 消食类功效
  { name: '消食健胃', description: '消化食积、健运脾胃' },
  // 活血化瘀类功效
  { name: '活血化瘀', description: '疏通血脉、消散瘀滞' },
  { name: '活血调经', description: '活血而调畅月经' },
  { name: '活血止痛', description: '活血而缓解疼痛' },
  // 化痰止咳平喘类功效
  { name: '燥湿化痰', description: '燥化湿痰' },
  { name: '清热化痰', description: '清化痰热' },
  { name: '润肺止咳', description: '滋润肺燥、止咳' },
  { name: '降气止咳', description: '降逆肺气、止咳' },
  // 安神类功效
  { name: '宁心安神', description: '安宁心神' },
  { name: '重镇安神', description: '质重镇降以安神' },
  // 平肝息风类功效
  { name: '平肝潜阳', description: '平抑肝阳、潜降' },
  { name: '息风止痉', description: '平息肝风、止痉挛' },
  // 开窍类功效
  { name: '开窍醒神', description: '开启窍闭、苏醒神志' },
  // 补虚类功效
  { name: '补气', description: '补益正气' },
  { name: '补血', description: '补益营血' },
  { name: '补阴', description: '滋补阴液' },
  { name: '补阳', description: '温补肾阳' },
  { name: '益气健脾', description: '补益脾气' },
  { name: '养血安神', description: '补养阴血、安定心神' },
  { name: '益胃生津', description: '滋养胃阴、生津液' },
  { name: '滋补肝肾', description: '补益肝肾之阴' },
  // 收涩类功效
  { name: '收敛固涩', description: '收敛耗散、固涩滑脱' },
  { name: '固精缩尿', description: '固摄精关、缩尿' },
  { name: '涩肠止泻', description: '涩肠以止泻' },
  // 止血类功效
  { name: '收敛止血', description: '收敛而止血' },
  { name: '散瘀止血', description: '化瘀而止血' },
  { name: '温经止血', description: '温通经脉而止血' },
];

// =============================================
// 药材-功效映射
// =============================================

const HERB_EFFICACIES = {
  '麻黄': ['发汗解表', '宣肺平喘', '利水渗湿'],
  '桂枝': ['发汗解表', '温中散寒', '活血化瘀'],
  '紫苏叶': ['发汗解表', '行气止痛'],
  '生姜': ['发汗解表', '温中散寒', '化痰止咳平喘'],
  '荆芥': ['祛风散寒', '散瘀止血'],
  '防风': ['祛风散寒', '祛风湿'],
  '羌活': ['祛风散寒', '祛风湿', '祛风止痛'],
  '白芷': ['祛风散寒', '祛风止痛', '通鼻窍', '清热解毒'],
  '细辛': ['祛风散寒', '祛风止痛', '温中散寒'],
  '薄荷': ['疏散风热', '清肝明目'],
  '牛蒡子': ['疏散风热', '清热解毒', '润肠通便'],
  '蝉蜕': ['疏散风热', '清肝明目', '息风止痉'],
  '桑叶': ['疏散风热', '清肝明目', '润肺止咳'],
  '菊花': ['疏散风热', '清肝明目', '清热解毒'],
  '葛根': ['疏散风热', '生津止渴'],
  '柴胡': ['疏散风热', '疏肝解郁', '升阳举陷'],
  '升麻': ['疏散风热', '清热解毒', '升阳举陷'],
  '淡豆豉': ['疏散风热', '宁心安神'],
  '石膏': ['清热泻火'],
  '知母': ['清热泻火', '补阴'],
  '栀子': ['清热泻火', '清热凉血', '利湿退黄'],
  '夏枯草': ['清热泻火', '清肝明目', '散结消肿'],
  '黄芩': ['清热燥湿', '清热泻火', '凉血止血'],
  '黄连': ['清热燥湿', '清热泻火', '清热解毒'],
  '黄柏': ['清热燥湿', '退虚热'],
  '龙胆': ['清热燥湿', '清热泻火'],
  '金银花': ['清热解毒', '疏散风热'],
  '连翘': ['清热解毒', '疏散风热'],
  '蒲公英': ['清热解毒', '利尿通淋'],
  '板蓝根': ['清热解毒', '清热凉血'],
  '鱼腥草': ['清热解毒', '利尿通淋'],
  '射干': ['清热解毒', '清热化痰'],
  '白头翁': ['清热解毒', '凉血止血'],
  '大青叶': ['清热解毒', '清热凉血'],
  '青黛': ['清热解毒', '清热凉血', '息风止痉'],
  '穿心莲': ['清热解毒', '清热凉血'],
  '生地黄': ['清热凉血', '补阴'],
  '玄参': ['清热凉血', '补阴', '清热解毒'],
  '牡丹皮': ['清热凉血', '活血化瘀'],
  '赤芍': ['清热凉血', '活血止痛'],
  '紫草': ['清热凉血', '活血化瘀', '清热解毒'],
  '地骨皮': ['清热凉血', '退虚热'],
  '白薇': ['清热凉血', '利尿通淋'],
  '胡黄连': ['退虚热', '清热燥湿'],
  '大黄': ['泻下攻积', '清热泻火', '清热凉血', '活血化瘀'],
  '芒硝': ['泻下攻积'],
  '番泻叶': ['泻下攻积'],
  '火麻仁': ['润肠通便'],
  '郁李仁': ['润肠通便', '利尿通淋'],
  '甘遂': ['泻下攻积'],
  '巴豆': ['泻下攻积', '温中散寒'],
  '独活': ['祛风湿', '祛风止痛'],
  '威灵仙': ['祛风湿', '祛风止痛'],
  '秦艽': ['祛风湿', '退虚热'],
  '防己': ['祛风湿', '利水渗湿', '祛风止痛'],
  '桑寄生': ['祛风湿', '补阳', '补肝肾、强筋骨'],
  '五加皮': ['祛风湿', '补阳', '利水渗湿'],
  '木瓜': ['舒筋活络', '芳香化湿'],
  '乌梢蛇': ['祛风湿', '息风止痉'],
  '广藿香': ['芳香化湿', '温中止呕'],
  '佩兰': ['芳香化湿'],
  '苍术': ['燥湿健脾', '祛风散寒'],
  '厚朴': ['燥湿健脾', '行气止痛'],
  '砂仁': ['芳香化湿', '行气止痛', '温中止呕'],
  '豆蔻': ['芳香化湿', '行气止痛', '温中止呕'],
  '茯苓': ['利水渗湿', '益气健脾', '宁心安神'],
  '薏苡仁': ['利水渗湿', '益气健脾'],
  '猪苓': ['利水渗湿'],
  '泽泻': ['利水渗湿', '清热泻火'],
  '车前草': ['利尿通淋', '清热凉血', '清热解毒'],
  '车前子': ['利尿通淋', '清肝明目'],
  '茵陈': ['利湿退黄', '清热解毒'],
  '金钱草': ['利湿退黄', '利尿通淋', '清热解毒'],
  '虎杖': ['利湿退黄', '清热解毒', '活血化瘀', '化痰止咳平喘'],
  '木通': ['利尿通淋', '宁心安神'],
  '瞿麦': ['利尿通淋', '活血化瘀'],
  '海金沙': ['利尿通淋'],
  '石韦': ['利尿通淋', '凉血止血'],
  '附子': ['回阳救逆', '补火助阳', '温中散寒'],
  '干姜': ['温中散寒', '回阳救逆'],
  '肉桂': ['补火助阳', '温中散寒', '活血止痛'],
  '吴茱萸': ['温中散寒', '行气止痛', '止呕'],
  '小茴香': ['温中散寒', '行气止痛'],
  '花椒': ['温中散寒'],
  '丁香': ['温中散寒', '补阳'],
  '高良姜': ['温中散寒'],
  '陈皮': ['行气止痛', '燥湿健脾'],
  '青皮': ['疏肝解郁', '行气止痛'],
  '枳实': ['行气止痛'],
  '木香': ['行气止痛'],
  '香附': ['疏肝解郁', '行气止痛'],
  '川楝子': ['行气止痛'],
  '乌药': ['行气止痛', '温中散寒'],
  '佛手': ['疏肝解郁', '行气止痛'],
  '薤白': ['行气止痛'],
  '大腹皮': ['行气止痛', '利水渗湿'],
  '山楂': ['消食健胃', '活血化瘀'],
  '神曲': ['消食健胃'],
  '麦芽': ['消食健胃'],
  '莱菔子': ['消食健胃', '化痰止咳平喘'],
  '鸡内金': ['消食健胃'],
  '大蓟': ['凉血止血', '清热解毒'],
  '小蓟': ['凉血止血', '清热解毒'],
  '侧柏叶': ['凉血止血', '化痰止咳平喘'],
  '白茅根': ['凉血止血', '清热利尿'],
  '三七': ['散瘀止血', '活血止痛'],
  '茜草': ['凉血止血', '活血化瘀'],
  '蒲黄': ['散瘀止血'],
  '艾叶': ['温经止血', '温中散寒'],
  '地榆': ['凉血止血', '清热解毒'],
  '白及': ['收敛止血', '消肿生肌'],
  '仙鹤草': ['收敛止血'],
  '川芎': ['活血化瘀', '行气止痛', '祛风止痛'],
  '延胡索': ['活血止痛', '行气止痛'],
  '郁金': ['活血止痛', '行气止痛', '清热凉血', '利湿退黄'],
  '姜黄': ['活血止痛', '行气止痛'],
  '乳香': ['活血止痛'],
  '没药': ['活血止痛'],
  '丹参': ['活血化瘀', '清热凉血', '宁心安神'],
  '红花': ['活血化瘀', '活血止痛'],
  '桃仁': ['活血化瘀', '润肠通便', '化痰止咳平喘'],
  '牛膝': ['活血化瘀', '补阳', '利尿通淋'],
  '益母草': ['活血调经', '利尿通淋', '清热解毒'],
  '鸡血藤': ['活血补血', '活血调经', '舒筋活络'],
  '莪术': ['活血化瘀', '行气止痛'],
  '三棱': ['活血化瘀', '行气止痛'],
  '水蛭': ['活血化瘀'],
  '穿山甲': ['活血化瘀'],
  '王不留行': ['活血化瘀', '利尿通淋'],
  '半夏': ['燥湿化痰', '止呕'],
  '天南星': ['燥湿化痰', '息风止痉'],
  '白前': ['化痰止咳平喘'],
  '前胡': ['化痰止咳平喘', '疏散风热'],
  '桔梗': ['化痰止咳平喘'],
  '川贝母': ['清热化痰', '润肺止咳'],
  '浙贝母': ['清热化痰'],
  '瓜蒌': ['清热化痰', '润肠通便'],
  '竹茹': ['清热化痰'],
  '苦杏仁': ['降气止咳', '润肠通便'],
  '紫苏子': ['降气止咳', '润肠通便'],
  '百部': ['润肺止咳'],
  '款冬花': ['润肺止咳', '化痰止咳平喘'],
  '紫菀': ['润肺止咳', '化痰止咳平喘'],
  '桑白皮': ['化痰止咳平喘', '利水渗湿'],
  '葶苈子': ['化痰止咳平喘', '利水渗湿'],
  '白果': ['化痰止咳平喘'],
  '酸枣仁': ['宁心安神'],
  '柏子仁': ['宁心安神', '润肠通便'],
  '远志': ['宁心安神', '化痰止咳平喘'],
  '合欢皮': ['宁心安神', '活血化瘀'],
  '首乌藤': ['养血安神'],
  '朱砂': ['重镇安神', '清热解毒'],
  '磁石': ['重镇安神', '平肝潜阳'],
  '天麻': ['息风止痉', '平肝潜阳', '祛风止痛'],
  '钩藤': ['息风止痉', '清热泻火', '平肝潜阳'],
  '全蝎': ['息风止痉', '祛风止痛'],
  '蜈蚣': ['息风止痉', '祛风止痛'],
  '地龙': ['清热化痰', '息风止痉', '利尿通淋'],
  '僵蚕': ['息风止痉', '化痰止咳平喘'],
  '石决明': ['平肝潜阳', '清肝明目'],
  '珍珠母': ['平肝潜阳', '重镇安神'],
  '牡蛎': ['重镇安神', '平肝潜阳'],
  '代赭石': ['平肝潜阳', '凉血止血'],
  '麝香': ['开窍醒神', '活血化瘀'],
  '冰片': ['开窍醒神'],
  '石菖蒲': ['开窍醒神', '芳香化湿'],
  '苏合香': ['开窍醒神'],
  '人参': ['补气', '益气健脾', '生津止渴', '宁心安神'],
  '红参': ['补气', '回阳救逆'],
  '西洋参': ['补气', '补阴', '清热泻火'],
  '党参': ['补气', '益气健脾'],
  '太子参': ['补气', '益气健脾'],
  '黄芪': ['补气', '益气健脾', '利水渗湿'],
  '白术': ['益气健脾', '燥湿健脾'],
  '山药': ['补气', '益气健脾', '补阴'],
  '白扁豆': ['益气健脾', '芳香化湿'],
  '甘草': ['补气', '益气健脾', '清热解毒', '化痰止咳平喘'],
  '大枣': ['补气', '养血安神'],
  '绞股蓝': ['补气', '益气健脾', '清热解毒', '化痰止咳平喘'],
  '鹿茸': ['补阳', '补血'],
  '巴戟天': ['补阳', '祛风湿'],
  '淫羊藿': ['补阳', '祛风湿'],
  '仙茅': ['补阳', '祛风湿'],
  '杜仲': ['补阳', '补肝肾、强筋骨'],
  '续断': ['补阳', '活血化瘀'],
  '肉苁蓉': ['补阳', '润肠通便'],
  '锁阳': ['补阳', '润肠通便'],
  '补骨脂': ['补阳'],
  '益智仁': ['补阳'],
  '菟丝子': ['补阳', '补阴', '清肝明目'],
  '沙苑子': ['补阳', '清肝明目'],
  '蛤蚧': ['补阳', '补气'],
  '冬虫夏草': ['补阳', '补阴', '化痰止咳平喘'],
  '紫河车': ['补阳', '补血', '补气'],
  '当归': ['补血', '活血调经', '润肠通便'],
  '熟地黄': ['补血', '补阴'],
  '白芍': ['补血', '平肝潜阳'],
  '何首乌': ['补血', '补阴', '润肠通便'],
  '阿胶': ['补血', '补阴', '凉血止血'],
  '龙眼肉': ['补血', '养血安神'],
  '枸杞子': ['补阴', '清肝明目', '滋补肝肾'],
  '北沙参': ['补阴', '益胃生津'],
  '南沙参': ['补阴', '化痰止咳平喘'],
  '麦冬': ['补阴', '益胃生津', '宁心安神'],
  '天冬': ['补阴', '益胃生津'],
  '石斛': ['补阴', '益胃生津', '清肝明目'],
  '玉竹': ['补阴', '益胃生津'],
  '黄精': ['补阴', '益气健脾'],
  '百合': ['补阴', '宁心安神'],
  '墨旱莲': ['补阴', '凉血止血'],
  '女贞子': ['补阴', '滋补肝肾', '清肝明目'],
  '桑椹': ['补阴', '补血', '润肠通便'],
  '龟甲': ['补阴', '补阳'],
  '鳖甲': ['补阴', '平肝潜阳'],
  '五味子': ['收敛固涩', '益气生津', '宁心安神'],
  '乌梅': ['敛肺止咳', '涩肠止泻', '生津止渴'],
  '山茱萸': ['补益肝肾', '收敛固涩'],
  '诃子': ['涩肠止泻', '敛肺止咳'],
  '肉豆蔻': ['涩肠止泻', '温中散寒', '行气止痛'],
  '芡实': ['益肾固精', '健脾止泻'],
  '莲子': ['益肾固精', '健脾止泻', '养心安神'],
  '金樱子': ['固精缩尿', '涩肠止泻'],
  '覆盆子': ['益肾固精', '养肝明目'],
  '桑螵蛸': ['固精缩尿', '补阳'],
  '海螵蛸': ['收敛止血', '固精止带'],
  '浮小麦': ['固表止汗'],
  '糯稻根须': ['固表止汗', '益胃生津'],
};

// =============================================
// 主逻辑
// =============================================

async function initHerbDatabase() {
  try {
    logger.info('🔄 开始初始化药材知识库...');

    // 连接数据库（自动创建表 + 插入参考数据）
    await databaseManager.connect();
    const db = databaseManager.getDatabase();

    // 查询参考数据 ID 映射
    const getMap = async (table) => {
      const rows = await new Promise((resolve, reject) => {
        db.all(`SELECT id, name FROM ${table}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      const map = {};
      rows.forEach(r => map[r.name] = r.id);
      return map;
    };

    const categoryMap = await getMap('herb_categories');
    const regionMap = await getMap('herb_regions');
    const sourceMap = await getMap('herb_sources');
    const propertyMap = await getMap('properties');
    const meridianMap = await getMap('meridians');
    const efficacyMap = await getMap('efficacies');

    logger.info(`参考数据加载完成：${Object.keys(categoryMap).length} 分类, ${Object.keys(regionMap).length} 产地, ${Object.keys(sourceMap).length} 来源, ${Object.keys(propertyMap).length} 性味, ${Object.keys(meridianMap).length} 归经, ${Object.keys(efficacyMap).length} 功效`);

    // 1. 插入功效标签
    for (const eff of EFFICACIES) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR IGNORE INTO efficacies (name, description) VALUES (?, ?)',
          [eff.name, eff.description],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    // 重新查询功效ID
    const fullEfficacyMap = await getMap('efficacies');
    logger.info(`功效标签插入完成: ${Object.keys(fullEfficacyMap).length} 条`);

    // 2. 插入药材 + 性味归经关联
    let herbCount = 0;
    let propertyCount = 0;
    let meridianCount = 0;
    let efficacyCount = 0;

    for (const [categoryName, herbs] of Object.entries(HERBS)) {
      const categoryId = categoryMap[categoryName];
      if (!categoryId) {
        logger.warn(`分类 "${categoryName}" 未找到，跳过`);
        continue;
      }

      for (const herb of herbs) {
        // 插入药材
        const herbId = await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO herbs (name, pinyin, alias, category_id, description, usage_dosage, caution) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [herb.name, herb.pinyin || null, herb.alias || null, categoryId, herb.description, herb.usage_dosage || null, herb.caution || null],
            function (err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });

        herbCount++;

        // 插入性味关联
        const herbProps = HERB_PROPERTIES[herb.name];
        if (herbProps) {
          // 性味
          for (const propName of herbProps.properties) {
            const propId = propertyMap[propName];
            if (propId) {
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT OR IGNORE INTO herb_properties (herb_id, property_id) VALUES (?, ?)',
                  [herbId, propId],
                  (err) => err ? reject(err) : resolve()
                );
              });
              propertyCount++;
            }
          }

          // 归经
          for (const merName of herbProps.meridians) {
            const merId = meridianMap[merName];
            if (merId) {
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT OR IGNORE INTO herb_meridians (herb_id, meridian_id) VALUES (?, ?)',
                  [herbId, merId],
                  (err) => err ? reject(err) : resolve()
                );
              });
              meridianCount++;
            }
          }
        }

        // 插入功效关联
        const herbEffs = HERB_EFFICACIES[herb.name];
        if (herbEffs) {
          for (const effName of herbEffs) {
            const effId = fullEfficacyMap[effName];
            if (effId) {
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT OR IGNORE INTO herb_efficacies (herb_id, efficacy_id) VALUES (?, ?)',
                  [herbId, effId],
                  (err) => err ? reject(err) : resolve()
                );
              });
              efficacyCount++;
            }
          }
        }
      }
    }

    logger.info(`✅ 药材插入完成: ${herbCount} 味`);
    logger.info(`   性味关联: ${propertyCount} 条`);
    logger.info(`   归经关联: ${meridianCount} 条`);
    logger.info(`   功效关联: ${efficacyCount} 条`);

    // 3. 插入方剂
    let formulaCount = 0;
    let formulaHerbCount = 0;

    for (const formula of FORMULAS) {
      const formulaId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR IGNORE INTO formulas (name, pinyin, category, description, source) VALUES (?, ?, ?, ?, ?)',
          [formula.name, formula.pinyin || null, formula.category || null, formula.description, formula.source || null],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      formulaCount++;

      for (const fh of formula.herbs) {
        // 查找药材ID
        const herbRow = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM herbs WHERE name = ?', [fh.herbName], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (herbRow) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT OR IGNORE INTO formula_herbs (formula_id, herb_id, dosage, role) VALUES (?, ?, ?, ?)',
              [formulaId, herbRow.id, fh.dosage || null, fh.role || null],
              (err) => err ? reject(err) : resolve()
            );
          });
          formulaHerbCount++;
        } else {
          logger.warn(`方剂 "${formula.name}" 中未找到药材 "${fh.herbName}"，跳过`);
        }
      }
    }

    logger.info(`✅ 方剂插入完成: ${formulaCount} 首`);
    logger.info(`   方剂-药材关联: ${formulaHerbCount} 条`);

    // 4. 插入配伍规则
    let compatCount = 0;
    for (const rule of COMPATIBILITY_RULES) {
      const h1 = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM herbs WHERE name = ?', [rule.herb1Name], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      const h2 = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM herbs WHERE name = ?', [rule.herb2Name], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (h1 && h2) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO compatibility_rules (herb1_id, herb2_id, relation_type, description, source) VALUES (?, ?, ?, ?, ?)',
            [h1.id, h2.id, rule.relation_type, rule.description, rule.source || null],
            (err) => err ? reject(err) : resolve()
          );
        });
        compatCount++;
      }
    }

    logger.info(`✅ 配伍规则插入完成: ${compatCount} 条`);

    // 5. 创建管理员用户
    const bcrypt = require('bcryptjs');
    const adminUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ?', ['JunkangShen'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!adminUser) {
      const hash = await bcrypt.hash('kk20050318', 12);
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO users (username, email, password_hash, name, role, status, preferences)
           VALUES (?, ?, ?, ?, 'admin', 'active', '{"theme":"light","language":"zh-cn"}')`,
          ['JunkangShen', 'admin@herb-knowledge.local', hash, '管理员'],
          function(err) { if (err) reject(err); else resolve(); }
        );
      });
      logger.info('✅ 管理员用户创建成功: JunkangShen');
    } else {
      logger.info('管理员用户已存在，跳过');
    }

    // 汇总
    logger.info('');
    logger.info('='.repeat(50));
    logger.info('📊 药材知识库初始化完成！');
    logger.info(`   - 药材: ${herbCount} 味`);
    logger.info(`   - 方剂: ${formulaCount} 首`);
    logger.info(`   - 配伍规则: ${compatCount} 条`);
    logger.info(`   - 性味关联: ${propertyCount} 条`);
    logger.info(`   - 归经关联: ${meridianCount} 条`);
    logger.info(`   - 功效关联: ${efficacyCount} 条`);
    logger.info('='.repeat(50));

    await databaseManager.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ 药材知识库初始化失败:', error);
    process.exit(1);
  }
}

initHerbDatabase();
