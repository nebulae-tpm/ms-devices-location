const INTERNAL_SERVER_ERROR = 13001;

/**
 * class to emcapsulute diferent errors.
 */
class CustomError extends Error {

    constructor(name, method, code, message) {
      super(message); 
      this.code = code;
      this.name = name;
      this.method = method;
    }
  
    getContent(){
      return {
        name: this.name,
        code: this.code,
        msg: this.message,      
        method: this.method,
        stack: this.stack
      }
    }
  }

class DefaultError extends Error{
    constructor(message){
      super(message)
      this.code = INTERNAL_SERVER_ERROR;
      this.msg = message;
    }

    getContent(){
      return {
        code: this.code,
        msg: this.msg
      }
    }
}

  module.exports =  {
    CustomError, 
    DefaultError
  } 