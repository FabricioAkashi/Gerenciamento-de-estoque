import mongoose from 'mongoose';

const alertaEstoqueSchema = new mongoose.Schema(
  {
    produto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Produto',
      required: true
    },
    status: {
      type: String,
      enum: ['aberto', 'resolvido'],
      default: 'aberto'
    },
    mensagem: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

export const AlertaEstoque = mongoose.model('AlertaEstoque', alertaEstoqueSchema);
