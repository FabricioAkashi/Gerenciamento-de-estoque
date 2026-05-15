import mongoose from 'mongoose';
import { criarHashSenha, verificarSenha } from '../utils/security.js';

const usuarioSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    senhaHash: {
      type: String,
      required: true
    },
    papel: {
      type: String,
      enum: ['admin', 'operador'],
      default: 'operador'
    },
    ativo: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

usuarioSchema.methods.definirSenha = function definirSenha(senha) {
  this.senhaHash = criarHashSenha(senha);
};

usuarioSchema.methods.validarSenha = function validarSenha(senha) {
  return verificarSenha(senha, this.senhaHash);
};

usuarioSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    nome: this.nome,
    email: this.email,
    papel: this.papel,
    ativo: this.ativo,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

export const Usuario = mongoose.model('Usuario', usuarioSchema);