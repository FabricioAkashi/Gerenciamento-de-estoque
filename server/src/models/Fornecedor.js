import mongoose from 'mongoose';

const fornecedorSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },
    cnpj: {
      type: String,
      trim: true,
      default: ''
    },
    telefone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    endereco: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

export const Fornecedor = mongoose.model('Fornecedor', fornecedorSchema);
