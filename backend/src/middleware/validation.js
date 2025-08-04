const Joi = require('joi');
const logger = require('../utils/logger');

// 通用验证中间件
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('数据验证失败:', errorMessages);

      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors: errorMessages
      });
    }

    req[property] = value;
    next();
  };
};

// 用户注册验证规则
const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名至少需要3个字符',
      'string.max': '用户名不能超过30个字符',
      'any.required': '用户名是必填项'
    }),
  
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '请输入有效的邮箱地址',
      'any.required': '邮箱是必填项'
    }),
  
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': '密码至少需要6个字符',
      'string.max': '密码不能超过128个字符',
      'any.required': '密码是必填项'
    }),
  
  name: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': '姓名至少需要2个字符',
      'string.max': '姓名不能超过50个字符'
    })
});

// 用户登录验证规则
const userLoginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': '用户名是必填项'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': '密码是必填项'
    })
});

// 武器数据验证规则
const weaponSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': '武器名称至少需要2个字符',
      'string.max': '武器名称不能超过100个字符',
      'any.required': '武器名称是必填项'
    }),
  
  type: Joi.string()
    .valid('步枪', '手枪', '机枪', '狙击枪', '火箭筒', '坦克', '战斗机', '军舰', '导弹', '火炮', '其他')
    .required()
    .messages({
      'any.only': '武器类型必须是预定义的类型之一',
      'any.required': '武器类型是必填项'
    }),
  
  country: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': '制造国家至少需要2个字符',
      'string.max': '制造国家不能超过50个字符',
      'any.required': '制造国家是必填项'
    }),
  
  year: Joi.number()
    .integer()
    .min(1800)
    .max(2030)
    .optional()
    .allow(null)
    .messages({
      'number.base': '年份必须是数字',
      'number.integer': '年份必须是整数',
      'number.min': '年份不能早于1800年',
      'number.max': '年份不能超过2030年'
    }),
  
  description: Joi.string()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': '描述不能超过1000个字符'
    }),

  specifications: Joi.object()
    .optional()
    .messages({
      'object.base': '技术规格必须是对象格式'
    })
});

// 知识图谱查询验证规则
const knowledgeQuerySchema = Joi.object({
  query: Joi.string()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.min': '查询语句不能为空',
      'string.max': '查询语句不能超过1000个字符',
      'any.required': '查询语句是必填项'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': '限制数量必须是数字',
      'number.integer': '限制数量必须是整数',
      'number.min': '限制数量至少为1',
      'number.max': '限制数量不能超过100'
    })
});

module.exports = {
  validate,
  userRegistrationSchema,
  userLoginSchema,
  weaponSchema,
  knowledgeQuerySchema
};