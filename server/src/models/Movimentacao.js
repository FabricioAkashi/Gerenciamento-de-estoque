import mongoose from 'mongoose';

const movimentacaoSchema = new mongoose.Schema(
  {
    produto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Produto',
      required: true
    },
    tipo: {
      type: String,
      enum: ['entrada', 'saida', 'ajuste'],
      required: true
    },
    quantidade: {
      type: Number,
      required: true,
      min: 1
    },
    usuario: {
      type: String,
      required: true,
      trim: true,
      default: 'Operador'
    },
    observacao: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

export const Movimentacao = mongoose.model('Movimentacao', movimentacaoSchema);
