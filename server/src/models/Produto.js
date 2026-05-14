import mongoose from 'mongoose';

const produtoSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },
    categoria: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categoria',
      required: true
    },
    quantidadeAtual: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    unidadeMedida: {
      type: String,
      required: true,
      trim: true,
      default: 'un'
    },
    estoqueMinimo: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    precoUnitario: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    fornecedor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fornecedor',
      required: true
    },
    ativo: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

produtoSchema.virtual('emAlerta').get(function emAlerta() {
  return this.quantidadeAtual <= this.estoqueMinimo;
});

produtoSchema.set('toJSON', { virtuals: true });
produtoSchema.set('toObject', { virtuals: true });

export const Produto = mongoose.model('Produto', produtoSchema);
