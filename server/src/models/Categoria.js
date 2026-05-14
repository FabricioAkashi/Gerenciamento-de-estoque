import mongoose from 'mongoose';

const categoriaSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    descricao: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

export const Categoria = mongoose.model('Categoria', categoriaSchema);
