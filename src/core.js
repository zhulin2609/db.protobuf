'use strict'
/**
 * @file DB core
 * @date 2015-12-29
 * @depends Jquery|Zepto
 * option
 *     {
 *         host: '',
 *         ip: '',
 *         protocol: 'tcp' or 'udp'[defaule udp],
 *         proto: '',
 *         package: '',
 *         message: '',
 *         req: '',
 *         rsp: '',
 *         data: {
 *             
 *         },
 *         succ: function(data, option) { return false; // 反转至err},
 *         err: function(data, option) {}
 *     }
 * 创建请求
 *     let db = new DB(option)
 * 发送请求
 *     db(option)
 */

const $ = require('jquery');
const dgram = require('dgram');
const ProtoBuf = require("protobufjs");

/**
 * DB
 * @class
 * @param {Object} option
 */
class DB {
    constructor (option) {
        this.option = option;
    }

    /**
     * send
     * @param {Object} name
     */
    send(option) {
        return new Sender(this, option);
    };
}

/**
 * 合并option
 * 类似extend, 不同的是数组做concat操作
 * @param {Object} target
 * @param {..Object} args
 * @return {Object}
 */
function mergeOption(target) {
    let args = [].slice.call(arguments, 1);
    for (let i in args) {
        let item = args[i];
        for (let k in item) {
            let value = item[k];
            if ($.inArray(k, ['before', 'succ', 'err']) !== -1) {
                target[k] = (target[k] || [])
                    .concat($.isArray(value) ? value : [value]);
            } else {
                target[k] = value;
            }
        }
    }
    return target;
}



/**
 * 一次请求发送对象
 * before|succ|err 的this指针指向它
 * @class
 * @param {DB} db
 * @param {Object} option 
 */
class Sender(db, option) {
    constructor(db, option) {
        this.db = db;
        this.option = mergeOption({}, DB.option, db.option, option);
    }


    /**
     * 执行成功 
     * succ可以返回false以反转至失败
     * @param {Object} data
     */
    processSucc(data) {
        let succ = true;
        for (let i = 0; this.option.succ && i < this.option.succ.length; i++) {
            if (this.option.succ[i].call(this, data, i) === false) {
                succ = false;
                break;
            }
        }
        !succ && this.processErr(data);
    }

    /**
     * 执行失败
     * @param {Object} data
     * @param {?Boolean} data.networkError 是否是网络失败
     * @param {?Number} data.status 网络失败时的状态码
     */
    processErr(data) {
        for (let i = 0; this.option.err && i < this.option.err.length; i++) {
            this.option.err[i].call(this, data, i)
        }
    }

    send() {
        let option = this.option
        let builder = ProtoBuf.loadProtoFile(option.proto),
            packageObj = builder.build(option.package),
            MsgReq = packageObj[option.message][option.req],
            MsgRsp = packageObj[option.message][option.rsp];
        let reqData = new MsgReq(option.data);
        let reqBuffer = reqData.encode();
        let reqMsg = reqBuffer.toBuffer();
        let self = this;
        if(this.option.protocol === 'udp') {
            let socket = dgram.createSocket({
                type: 'udp4'
            }, function(err, message) {
                if(err) {
                    console.dir(err);
                }
            });
            socket.send(reqMsg, 0, reqMsg.length, option.port, option.host, function(err, bytes) {
                if(err) {
                    throw err;
                }

                console.log('UDP message sent to ' + HOST +':'+ PORT);
            });

            socket.on("message", function (msg, rinfo) {

                console.log(MsgRsp.decode(msg));

                socket.close();

                //udpSocket = null;
            });

            socket.on('close', function(){
                console.log('socket closed.');

            });

            socket.on('error', function(err){
                self.processErr(
                    {
                        networkError: true,
                        err: err
                    }
                );
                socket.close();

                console.log('socket err');
                console.log(err);
            });
        } else{

        }
    }

    this.xhr = $.ajax($.extend({}, self.option, {
        success: function(data) {
            self.processSucc(data);
        },
        error: function(xhr) {
            self.processErr(
                {
                    networkError: true,
                    status: xhr.status
                } 
            );
        }
    }));
}







$.extend(DB , {
    /**
     * 直接发送ajax 类似$.ajax
     * @param {Object} option
     * @return {Sender}
     */
    send: function(option) {
        return new DB().send(option);
    },

    /**
     * 扩展自身
     * @param {?Object} args
     */
    extend: function() {
        let args = [].slice.call(arguments);
        args.unshift(this);
        return $.extend.apply($, args);
    },

    /**
     * 扩展全局设置
     * @param {?Object} args
     */
    mergeOption: function() {
        let args = [].slice.call(arguments);
        args.unshift(this.option);
        this.option = mergeOption.apply(null, args);
    },
    
    /**
     * 全局设置
     * @type {Object}
     */
    option: {}
});

module.exports = DB;